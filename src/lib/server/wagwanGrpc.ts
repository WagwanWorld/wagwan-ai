/**
 * gRPC client for Wagwan AuthService.
 *
 * Connects to the Wagwan Go backend to handle phone OTP auth.
 * Reads WAGWAN_GRPC_URL from env (default: 127.0.0.1:50051).
 */

import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { env } from '$env/dynamic/private';
import { join } from 'path';

const PROTO_DIR = join(process.cwd(), 'src', 'lib', 'server', 'proto');
const AUTH_PROTO = join(PROTO_DIR, 'wagwan', 'auth', 'api', 'v1', 'auth.proto');

const packageDef = protoLoader.loadSync(AUTH_PROTO, {
  keepCase: false,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
  includeDirs: [PROTO_DIR],
});

const proto = grpc.loadPackageDefinition(packageDef) as any;
const AuthService = proto.wagwan.auth.api.v1.AuthService;

let client: InstanceType<typeof AuthService> | null = null;

function getClient(): InstanceType<typeof AuthService> {
  if (client) return client;
  const url = env.WAGWAN_GRPC_URL?.trim() || '127.0.0.1:50051';
  client = new AuthService(url, grpc.credentials.createInsecure());
  return client;
}

/**
 * Send an OTP to the given phone number.
 * Phone must be 13 chars, e.g. "+919327786555".
 */
export function generateOTP(phone: string): Promise<void> {
  return new Promise((resolve, reject) => {
    getClient().generateOTP({ phone }, (err: grpc.ServiceError | null) => {
      if (err) {
        console.error('[WagwanGrpc] GenerateOTP error:', err.message);
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

/**
 * Verify a login OTP and receive access + refresh tokens.
 * Works for both new and existing users.
 */
export function verifyLoginOTP(
  phone: string,
  otp: string,
): Promise<{ accessToken: string; refreshToken: string }> {
  return new Promise((resolve, reject) => {
    getClient().verifyLoginOTP({ phone, otp }, (err: grpc.ServiceError | null, res: any) => {
      if (err) {
        console.error('[WagwanGrpc] VerifyLoginOTP error:', err.message);
        reject(err);
      } else {
        resolve({
          accessToken: res.accessToken ?? '',
          refreshToken: res.refreshToken ?? '',
        });
      }
    });
  });
}
