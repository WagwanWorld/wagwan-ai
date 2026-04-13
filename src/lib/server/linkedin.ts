/**
 * LinkedIn OAuth 2.0 via Sign In with LinkedIn (OpenID Connect).
 *
 * What we get:
 *  - name, email, locale (country) from /userinfo
 *  - headline (current role + company) from /v2/me — requires r_liteprofile scope
 *    which needs LinkedIn partner approval; we try it and fall back gracefully
 *
 * Claude analyses the available data to infer:
 *  - Current role, company, seniority, industry, skills, ideal next roles
 *
 * Setup:
 *  1. Create app at https://developer.linkedin.com/
 *  2. Products → "Sign In with LinkedIn using OpenID Connect"
 *  3. Auth → OAuth 2.0 settings → add redirect URI exactly:
 *     `${PUBLIC_BASE_URL}/auth/linkedin/callback` (same string as REDIRECT_URI below; no trailing slash)
 *  4. Copy Client ID and Primary Client Secret to .env
 */

import Anthropic from '@anthropic-ai/sdk';
import { ANTHROPIC_API_KEY, LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET } from '$env/static/private';
import { PUBLIC_BASE_URL } from '$env/static/public';
import type { LinkedInIdentity } from '$lib/utils';

export { type LinkedInIdentity };

const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
const REDIRECT_URI = `${PUBLIC_BASE_URL}/auth/linkedin/callback`;

export function isLinkedInConfigured(): boolean {
  return !!(LINKEDIN_CLIENT_ID && LINKEDIN_CLIENT_SECRET);
}

export function getLinkedInAuthUrl(state: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: LINKEDIN_CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    // openid + profile + email = name, picture, locale, email via /userinfo
    // r_liteprofile is a legacy scope requiring LinkedIn partner approval — omitted
    scope: 'openid profile email',
    state,
  });
  return `https://www.linkedin.com/oauth/v2/authorization?${params}`;
}

export async function exchangeLinkedInCode(code: string): Promise<string> {
  const res = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
      client_id: LINKEDIN_CLIENT_ID,
      client_secret: LINKEDIN_CLIENT_SECRET,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`LinkedIn token exchange failed: ${err}`);
  }
  const data = await res.json();
  return data.access_token as string;
}

// ── LinkedIn API helpers ───────────────────────────────────────────────────

interface LIUserInfo {
  sub?: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  email?: string;
  locale?: { country?: string; language?: string };
  headline?: string; // present if r_liteprofile approved
}

interface LIMe {
  headline?: { localized?: Record<string, string> };
  industryName?: { localized?: Record<string, string> };
}

export async function fetchLinkedInProfile(token: string): Promise<{
  name: string;
  email: string;
  headline: string;
  industry: string;
  country: string;
}> {
  const headers = {
    Authorization: `Bearer ${token}`,
    'LinkedIn-Version': '202401',
  };

  // Primary: OpenID Connect userinfo (always works with openid scope)
  const userinfoRes = await fetch('https://api.linkedin.com/v2/userinfo', { headers });
  let userinfo: LIUserInfo = {};
  if (userinfoRes.ok) {
    try {
      userinfo = await userinfoRes.json();
    } catch {
      userinfo = {};
    }
  } else {
    const errText = await userinfoRes.text().catch(() => '');
    console.error(
      '[LinkedIn] userinfo failed:',
      userinfoRes.status,
      errText.slice(0, 200),
    );
  }

  // Secondary: /v2/me with liteProfile projection (works if r_liteprofile approved)
  const meRes = await fetch(
    'https://api.linkedin.com/v2/me?projection=(headline,industryName)',
    { headers }
  ).catch(() => null);

  let headline = userinfo.headline ?? '';
  let industry = '';

  if (meRes?.ok) {
    const me: LIMe = await meRes.json();
    // Grab first available localised value
    if (!headline && me.headline?.localized) {
      headline = Object.values(me.headline.localized)[0] ?? '';
    }
    if (me.industryName?.localized) {
      industry = Object.values(me.industryName.localized)[0] ?? '';
    }
  }

  return {
    name: userinfo.name ?? `${userinfo.given_name ?? ''} ${userinfo.family_name ?? ''}`.trim(),
    email: userinfo.email ?? '',
    headline,
    industry,
    country: userinfo.locale?.country ?? '',
  };
}

export async function analyseLinkedInIdentity(
  name: string,
  headline: string,
  industry: string,
  city: string,
  country: string,
  email?: string,
): Promise<LinkedInIdentity> {
  const loc = [city?.trim(), country?.trim()].filter(Boolean).join(', ');

  const contextLines = [
    name?.trim() && `Name: ${name.trim()}`,
    headline?.trim() && `Professional headline: ${headline.trim()}`,
    industry?.trim() && `Industry: ${industry.trim()}`,
    city?.trim() && `City: ${city.trim()}`,
    country?.trim() && `Country: ${country.trim()}`,
    email?.trim() && `Email: ${email.trim()}`,
  ].filter(Boolean) as string[];

  const context = contextLines.join('\n');

  if (!context.trim()) {
    const nm = name?.trim() ?? '';
    return {
      name: name ?? '',
      headline: headline ?? '',
      industry: industry ?? '',
      location: loc,
      seniority: 'mid-level',
      currentRole: '',
      currentCompany: '',
      skills: [],
      jobInterests: [],
      careerSummary: nm
        ? `LinkedIn connected as ${nm}. No headline or industry returned from the API yet.`
        : '',
      skillClusters: [],
      industryAffinity: [],
      professionalThemeTags: [],
      linkedinIntentHints: [],
    };
  }

  const openIdOnlyHint =
    !headline?.trim() && !industry?.trim()
      ? `\n\nNote: This is often all we get from "Sign in with LinkedIn" (OpenID) without partner-approved profile APIs. Infer conservative professional signals from name, email domain (if present), and country only. If you cannot infer a title, set currentRole to a short placeholder like "Professional" and keep skills generic or empty.`
      : '';

  const prompt = `Analyse this LinkedIn professional data and extract career signals.

${context}${openIdOnlyHint}

Return JSON only (no markdown):
{
  "seniority": "entry-level | mid-level | senior | lead | executive",
  "currentRole": "job title only, e.g. 'Product Designer'",
  "currentCompany": "company name only, e.g. 'Swiggy'",
  "skills": ["up to 6 skills inferred from role/industry, e.g. 'Figma', 'product strategy', 'user research'"],
  "jobInterests": ["up to 4 types of roles they might be interested in next, e.g. 'Head of Design', 'Design Lead at Series B startup'"],
  "careerSummary": "1 concise sentence describing their career stage and trajectory",
  "skillClusters": ["up to 5 coarse clusters e.g. 'design', 'product', 'engineering', 'marketing', 'leadership'"],
  "industryAffinity": ["up to 4 e.g. 'technology', 'startup', 'enterprise', 'finance', 'consumer', 'saas'"],
  "professionalThemeTags": ["up to 6 snake_case tags for search e.g. 'product_designer', 'b2b_saas', 'people_manager'"],
  "linkedinIntentHints": [
    { "intent": "job_seeker | hiring | founder_builder | upskilling | stable", "confidence": 0.0-1.0, "time_horizon": "30_days | 90_days | ongoing" }
  ]
}`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      messages: [{ role: 'user', content: prompt }],
    });
    const text = response.content[0].type === 'text' ? response.content[0].text : '{}';
    const parsed = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] ?? '{}');
    const hints = Array.isArray(parsed.linkedinIntentHints)
      ? (parsed.linkedinIntentHints as LinkedInIdentity['linkedinIntentHints'])?.filter(
          h => h && typeof h.intent === 'string',
        ) ?? []
      : [];
    return {
      name,
      headline,
      industry: industry || '',
      location: loc || city || country,
      seniority: parsed.seniority ?? 'mid-level',
      currentRole: parsed.currentRole ?? '',
      currentCompany: parsed.currentCompany ?? '',
      skills: Array.isArray(parsed.skills) ? parsed.skills : [],
      jobInterests: Array.isArray(parsed.jobInterests) ? parsed.jobInterests : [],
      careerSummary: parsed.careerSummary ?? '',
      skillClusters: Array.isArray(parsed.skillClusters) ? parsed.skillClusters.slice(0, 5) : [],
      industryAffinity: Array.isArray(parsed.industryAffinity) ? parsed.industryAffinity.slice(0, 4) : [],
      professionalThemeTags: Array.isArray(parsed.professionalThemeTags)
        ? parsed.professionalThemeTags.slice(0, 6)
        : [],
      linkedinIntentHints: hints.slice(0, 4),
    };
  } catch {
    return {
      name,
      headline,
      industry,
      location: loc,
      seniority: 'mid-level',
      currentRole: name?.trim() ? 'Professional' : '',
      currentCompany: '',
      skills: [],
      jobInterests: [],
      careerSummary: name?.trim()
        ? `LinkedIn connected as ${name.trim()}${country ? ` (${country})` : ''}. Headline and industry require expanded LinkedIn API access to sync automatically.`
        : '',
      skillClusters: [],
      industryAffinity: [],
      professionalThemeTags: [],
      linkedinIntentHints: [],
    };
  }
}
