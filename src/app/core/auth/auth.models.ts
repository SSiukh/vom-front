export interface LoginRequest {
  login: string;
  password: string;
}

export type LoginResponse =
  | { requiresTwoFa: true; pendingToken: string }
  | { requiresTwoFa: false; accessToken: string; refreshToken: string };

export interface VerifyLoginRequest {
  pendingToken: string;
  code: string;
}

export interface TokenPairResponse {
  accessToken: string;
  refreshToken: string;
}

export interface RefreshRequest {
  refreshToken: string;
}

export interface SetupTwoFaResponse {
  qrCodeDataUrl: string;
  secret: string;
}

export interface ConfirmTwoFaRequest {
  code: string;
}

export interface ConfirmTwoFaResponse {
  recoveryCodes: string[];
}

export interface TwoFaStatusResponse {
  twoFaEnabled: boolean;
}
