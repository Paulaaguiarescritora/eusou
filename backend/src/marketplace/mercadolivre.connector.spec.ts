import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { MercadoLivreConnector } from './mercadolivre.connector';
import { CredentialEncryptionService } from './credential-encryption.service';
import { ProductMapperService } from './product-mapper.service';
import { MercadoLivrePriceAdapter } from './mercadolivre-price.adapter';
import { MercadoLivreStockAdapter } from './mercadolivre-stock.adapter';

describe('MercadoLivreConnector', () => {
  let connector: MercadoLivreConnector;
  let encryption: CredentialEncryptionService;
  let config: any;
  let mapper: ProductMapperService;

  beforeEach(async () => {
    config = {
      get: jest.fn((key: string) => {
        if (key === 'MERCADOLIVRE_CLIENT_ID') return '123456789';
        if (key === 'MERCADOLIVRE_CLIENT_SECRET') return 'test-client-secret';
        if (key === 'MERCADOLIVRE_REDIRECT_URI')
          return 'http://localhost:3000/callback';
        if (key === 'MERCADOLIVRE_ENCRYPTION_KEY')
          return '01234567890123456789012345678901';
        return null;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MercadoLivreConnector,
        MercadoLivrePriceAdapter,
        MercadoLivreStockAdapter,
        CredentialEncryptionService,
        ProductMapperService,
        { provide: ConfigService, useValue: config },
      ],
    }).compile();

    connector = module.get<MercadoLivreConnector>(MercadoLivreConnector);
    encryption = module.get<CredentialEncryptionService>(
      CredentialEncryptionService,
    );
    mapper = module.get<ProductMapperService>(ProductMapperService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('deve estar definido', () => {
    expect(connector).toBeDefined();
    expect(connector.channelType).toBe('MERCADO_LIVRE');
  });

  describe('Criptografia Segura (AES-256-GCM)', () => {
    it('deve criptografar e descriptografar tokens preservando o valor e gerando IV/Tag', () => {
      const rawToken = 'APP_USR-789456123-real-mercadolibre-token';
      const enc = encryption.encrypt(rawToken);

      expect(enc.iv).toBeDefined();
      expect(enc.tag).toBeDefined();
      expect(enc.encryptedData).toBeDefined();
      expect(enc.encryptedData).not.toBe(rawToken);

      const decrypted = encryption.decrypt(enc);
      expect(decrypted).toBe(rawToken);
    });
  });

  describe('OAuth 2.0 & Gestão de Tokens', () => {
    it('deve gerar a URL de autorização oficial do Mercado Livre', () => {
      const url = connector.getAuthorizationUrl('state123');
      expect(url).toContain('https://auth.mercadolivre.com.br/authorization');
      expect(url).toContain('client_id=123456789');
      expect(url).toContain('response_type=code');
      expect(url).toContain('state=state123');
    });

    it('deve trocar authorization code por tokens e criptografá-los', async () => {
      const mockResponse = {
        access_token: 'ML-ACCESS-TOKEN-123',
        refresh_token: 'ML-REFRESH-TOKEN-456',
        expires_in: 21600,
        user_id: 998877,
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      } as any);

      const res = await connector.exchangeCodeForTokens('mock-code-123');
      expect(res.accessToken).toBe('ML-ACCESS-TOKEN-123');
      expect(res.refreshToken).toBe('ML-REFRESH-TOKEN-456');
      expect(res.userId).toBe('998877');
      expect(res.encryptedConfig.encAccessToken).toBeDefined();
      expect(res.encryptedConfig.encRefreshToken).toBeDefined();
    });

    it('deve renovar token via refresh_token oficial', async () => {
      const encRefreshToken = encryption.encrypt('OLD-REFRESH-TOKEN');

      const mockRefreshResponse = {
        access_token: 'NEW-ML-ACCESS-TOKEN',
        refresh_token: 'NEW-ML-REFRESH-TOKEN',
        expires_in: 21600,
        user_id: 998877,
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => mockRefreshResponse,
      } as any);

      const res = await connector.refreshAccessToken({
        encRefreshToken,
      });

      expect(res.accessToken).toBe('NEW-ML-ACCESS-TOKEN');
      expect(res.refreshToken).toBe('NEW-ML-REFRESH-TOKEN');
      expect(res.updatedConfig.encAccessToken).toBeDefined();
      expect(res.updatedConfig.encRefreshToken).toBeDefined();
    });
  });

  describe('testConnection (Ping via /users/me)', () => {
    it('deve retornar sucesso com dados do vendedor quando HTTP 200', async () => {
      const encAccessToken = encryption.encrypt('VALID-TOKEN');

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 998877,
          nickname: 'EUSOU_OFICIAL',
          site_id: 'MLB',
        }),
      } as any);

      const res = await connector.testConnection({ encAccessToken });
      expect(res.success).toBe(true);
      expect(res.message).toContain('EUSOU_OFICIAL');
    });

    it('deve retornar erro tratado sem expor token quando HTTP 401', async () => {
      const encAccessToken = encryption.encrypt('INVALID-TOKEN');

      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized token',
      } as any);

      const res = await connector.testConnection({ encAccessToken });
      expect(res.success).toBe(false);
      expect(res.errorCode).toBe('PING_401');
      expect(res.message).not.toContain('INVALID-TOKEN');
    });
  });

  describe('publishProduct (POST /items)', () => {
    it('deve publicar produto e retornar externalProductId e permalink', async () => {
      const encAccessToken = encryption.encrypt('VALID-TOKEN');

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 'MLB1234567890',
          permalink: 'https://produto.mercadolivre.com.br/MLB-1234567890-gato',
          status: 'active',
          price: 49.9,
        }),
      } as any);

      const payload = {
        sku: 'FEL-GAT-001',
        title: 'Porta-Chaves Gatinho 3D',
        description: 'Chaveiro moderno',
        price: 49.9,
        currency: 'BRL',
        stockQuantity: 15,
        categoryExternalId: 'MLB3530',
        attributes: { BRAND: 'EuSou', MODEL: 'Gato' },
        images: ['https://cdn.example.com/gato.png'],
      };

      const res = await connector.publishProduct(payload, { encAccessToken });
      expect(res.success).toBe(true);
      expect(res.externalProductId).toBe('MLB1234567890');
      expect(res.externalUrl).toContain('mercadolivre.com.br');
    });

    it('deve tratar erro 400 com causa amigável da API do Mercado Livre', async () => {
      const encAccessToken = encryption.encrypt('VALID-TOKEN');

      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({
          message: 'Validation error',
          error: 'validation_error',
          cause: [{ message: 'Atributo BRAND é obrigatório nesta categoria' }],
        }),
      } as any);

      const payload = {
        sku: 'FEL-GAT-001',
        title: 'Porta-Chaves Gatinho 3D',
        description: 'Chaveiro moderno',
        price: 49.9,
        currency: 'BRL',
        stockQuantity: 15,
        images: ['https://cdn.example.com/gato.png'],
        attributes: {},
      };

      const res = await connector.publishProduct(payload, { encAccessToken });
      expect(res.success).toBe(false);
      expect(res.errorCode).toBe('validation_error');
      expect(res.message).toContain('Atributo BRAND é obrigatório');
    });
  });

  describe('updatePrice e updateStock (PUT /items/{id})', () => {
    it('deve sincronizar preço com sucesso', async () => {
      const encAccessToken = encryption.encrypt('VALID-TOKEN');

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'MLB123', price: 59.9 }),
      } as any);

      const res = await connector.updatePrice('MLB123', 59.9, {
        encAccessToken,
      });
      expect(res.success).toBe(true);
      expect(res.rawResponse.price).toBe(59.9);
    });

    it('deve sincronizar estoque com sucesso', async () => {
      const encAccessToken = encryption.encrypt('VALID-TOKEN');

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'MLB123', available_quantity: 25 }),
      } as any);

      const res = await connector.updateStock('MLB123', 25, { encAccessToken });
      expect(res.success).toBe(true);
      expect(res.rawResponse.available_quantity).toBe(25);
    });
  });

  describe('unpublishProduct (PUT /items/{id} com status paused)', () => {
    it('deve pausar anúncio no Mercado Livre', async () => {
      const encAccessToken = encryption.encrypt('VALID-TOKEN');

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'MLB123', status: 'paused' }),
      } as any);

      const res = await connector.unpublishProduct('MLB123', {
        encAccessToken,
      });
      expect(res.success).toBe(true);
      expect(res.rawResponse.status).toBe('paused');
    });
  });

  describe('Validação Pré-Publicação (ProductMapper)', () => {
    it('deve aprovar produto válido para Mercado Livre', () => {
      const validProduct = {
        name: 'Porta-Chaves Gatinho 3D Impressão',
        status: 'ACTIVE',
        basePrice: 35.0,
        media: [{ url: 'https://cdn.example.com/foto.jpg' }],
        inventories: [{ quantity: 10, reservedQuantity: 0 }],
      };

      const val = mapper.validateForMercadoLivre(validProduct, {
        externalCategoryId: 'MLB1234',
      });
      expect(val.isValid).toBe(true);
      expect(val.errors).toHaveLength(0);
    });

    it('deve reprovar produto sem imagens públicas ou sem categoria mapeada', () => {
      const invalidProduct = {
        name: 'Gato',
        status: 'ACTIVE',
        basePrice: 0,
        media: [],
      };

      const val = mapper.validateForMercadoLivre(invalidProduct);
      expect(val.isValid).toBe(false);
      expect(val.errors.length).toBeGreaterThan(2);
      expect(val.errors).toEqual(
        expect.arrayContaining([
          expect.stringContaining(
            'Título do produto deve possuir no mínimo 5 caracteres',
          ),
          expect.stringContaining('Preço do produto deve ser maior que zero'),
          expect.stringContaining('Categoria do Mercado Livre não mapeada'),
          expect.stringContaining('exige pelo menos 1 imagem pública'),
        ]),
      );
    });
  });
});
