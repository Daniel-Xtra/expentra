import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

type OidcDiscoveryDocument = {
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint: string;
  issuer: string;
};

export type OidcTokenResponse = {
  access_token: string;
  id_token?: string;
  token_type?: string;
  expires_in?: number;
};

export type OidcUserInfo = {
  sub: string;
  email?: string;
  email_verified?: boolean;
  given_name?: string;
  family_name?: string;
  name?: string;
  preferred_username?: string;
  picture?: string;
};

@Injectable()
export class OidcService {
  private readonly logger = new Logger(OidcService.name);
  private discoveryCache: {
    document: OidcDiscoveryDocument;
    fetchedAt: number;
  } | null = null;

  private readonly DISCOVERY_TTL_MS = 60 * 60 * 1000;

  constructor(private readonly configService: ConfigService) {}

  isEnabled(): boolean {
    return this.configService.get<boolean>('SSO_ENABLED', false) === true;
  }

  assertEnabled(): void {
    if (!this.isEnabled()) {
      throw new ServiceUnavailableException('SSO is not enabled');
    }
  }

  getButtonLabel(): string {
    return (
      this.configService.get<string>('SSO_BUTTON_LABEL')?.trim() ||
      'Sign in with SSO'
    );
  }

  getRedirectUri(): string {
    return this.configService.getOrThrow<string>('SSO_REDIRECT_URI').trim();
  }

  getScopes(): string {
    return (
      this.configService.get<string>('SSO_SCOPES')?.trim() ||
      'openid profile email'
    );
  }

  createPkcePair(): { codeVerifier: string; codeChallenge: string } {
    const codeVerifier = base64Url(crypto.randomBytes(32));
    const codeChallenge = base64Url(
      crypto.createHash('sha256').update(codeVerifier).digest(),
    );
    return { codeVerifier, codeChallenge };
  }

  createState(): string {
    return base64Url(crypto.randomBytes(24));
  }

  async buildAuthorizationUrl(params: {
    state: string;
    codeChallenge: string;
  }): Promise<string> {
    const discovery = await this.getDiscovery();
    const clientId = this.configService.getOrThrow<string>('SSO_CLIENT_ID');
    const url = new URL(discovery.authorization_endpoint);
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('redirect_uri', this.getRedirectUri());
    url.searchParams.set('scope', this.getScopes());
    url.searchParams.set('state', params.state);
    url.searchParams.set('code_challenge', params.codeChallenge);
    url.searchParams.set('code_challenge_method', 'S256');
    return url.toString();
  }

  async exchangeAuthorizationCode(params: {
    code: string;
    codeVerifier: string;
  }): Promise<OidcTokenResponse> {
    const discovery = await this.getDiscovery();
    const clientId = this.configService.getOrThrow<string>('SSO_CLIENT_ID');
    const clientSecret =
      this.configService.getOrThrow<string>('SSO_CLIENT_SECRET');

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code: params.code,
      redirect_uri: this.getRedirectUri(),
      client_id: clientId,
      client_secret: clientSecret,
      code_verifier: params.codeVerifier,
    });

    const response = await fetch(discovery.token_endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body,
    });

    if (!response.ok) {
      const detail = await safeReadText(response);
      this.logger.warn(
        `OIDC token exchange failed: ${response.status} ${detail}`,
      );
      throw new ServiceUnavailableException(
        'SSO token exchange failed. Contact an administrator.',
      );
    }

    return (await response.json()) as OidcTokenResponse;
  }

  async fetchUserInfo(accessToken: string): Promise<OidcUserInfo> {
    const discovery = await this.getDiscovery();
    const response = await fetch(discovery.userinfo_endpoint, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      const detail = await safeReadText(response);
      this.logger.warn(`OIDC userinfo failed: ${response.status} ${detail}`);
      throw new ServiceUnavailableException(
        'SSO user profile lookup failed. Contact an administrator.',
      );
    }

    return (await response.json()) as OidcUserInfo;
  }

  private async getDiscovery(): Promise<OidcDiscoveryDocument> {
    const now = Date.now();
    if (
      this.discoveryCache &&
      now - this.discoveryCache.fetchedAt < this.DISCOVERY_TTL_MS
    ) {
      return this.discoveryCache.document;
    }

    const issuer = this.configService
      .getOrThrow<string>('SSO_ISSUER_URL')
      .replace(/\/$/, '');
    const discoveryUrl = `${issuer}/.well-known/openid-configuration`;

    const response = await fetch(discoveryUrl, {
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      this.logger.error(
        `OIDC discovery failed for ${discoveryUrl}: ${response.status}`,
      );
      throw new ServiceUnavailableException(
        'SSO identity provider is unavailable',
      );
    }

    const document = (await response.json()) as OidcDiscoveryDocument;
    if (
      !document.authorization_endpoint ||
      !document.token_endpoint ||
      !document.userinfo_endpoint
    ) {
      throw new ServiceUnavailableException(
        'SSO identity provider discovery document is incomplete',
      );
    }

    this.discoveryCache = { document, fetchedAt: now };
    return document;
  }
}

function base64Url(buffer: Buffer): string {
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

async function safeReadText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return '';
  }
}
