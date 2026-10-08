import { Test, TestingModule } from '@nestjs/testing';
import { ProductController } from './product.controller';
import { ProductService } from './product.service';
import { ProductStatus } from '@prisma/client';
import { RolesGuard } from '../auth/roles.guard';
import { Reflector } from '@nestjs/core';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';

describe('ProductController and Authorization', () => {
  let controller: ProductController;
  let service: any;
  let rolesGuard: RolesGuard;
  let reflector: Reflector;

  beforeEach(async () => {
    service = {
      create: jest.fn().mockResolvedValue({
        id: 'prod-1',
        name: 'Item Teste',
        slug: 'item-teste',
        status: ProductStatus.DRAFT,
      }),
      findAll: jest.fn().mockResolvedValue({
        data: [],
        meta: { total: 0, page: 1, limit: 10, totalPages: 1 },
      }),
      findById: jest.fn().mockResolvedValue({
        id: 'prod-1',
        name: 'Item Teste',
      }),
      update: jest.fn().mockResolvedValue({
        id: 'prod-1',
        name: 'Item Atualizado',
      }),
      delete: jest.fn().mockResolvedValue({
        message: 'Product archived successfully',
        id: 'prod-1',
      }),
    };

    reflector = new Reflector();
    rolesGuard = new RolesGuard(reflector);

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProductController],
      providers: [
        { provide: ProductService, useValue: service },
        { provide: Reflector, useValue: reflector },
        RolesGuard,
      ],
    }).compile();

    controller = module.get<ProductController>(ProductController);
  });

  describe('Endpoints execution', () => {
    it('should create product via POST /products with actorId from req', async () => {
      const mockReq: any = { user: { sub: 'admin-123' } };
      const dto = { name: 'Item Teste' };

      const result = await controller.create(dto, mockReq);
      expect(result.id).toBe('prod-1');
      expect(service.create).toHaveBeenCalledWith(dto, 'admin-123');
    });

    it('should list products via GET /products', async () => {
      const result = await controller.findAll({ page: 1, limit: 10 });
      expect(result.data).toBeDefined();
      expect(service.findAll).toHaveBeenCalledWith({ page: 1, limit: 10 });
    });

    it('should get product by id via GET /products/:id', async () => {
      const result = await controller.findById('prod-1');
      expect(result.id).toBe('prod-1');
      expect(service.findById).toHaveBeenCalledWith('prod-1');
    });

    it('should update product via PATCH /products/:id', async () => {
      const mockReq: any = { user: { sub: 'admin-123' } };
      const dto = { name: 'Item Atualizado' };

      const result = await controller.update('prod-1', dto, mockReq);
      expect(result.name).toBe('Item Atualizado');
      expect(service.update).toHaveBeenCalledWith('prod-1', dto, 'admin-123');
    });

    it('should delete (archive) product via DELETE /products/:id', async () => {
      const mockReq: any = { user: { sub: 'admin-123' } };

      const result = await controller.delete('prod-1', mockReq);
      expect(result.message).toBe('Product archived successfully');
      expect(service.delete).toHaveBeenCalledWith('prod-1', 'admin-123');
    });
  });

  describe('RBAC Authorization on ProductController', () => {
    const createMockContext = (userRoles?: string[]): ExecutionContext => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['admin']);

      return {
        getHandler: jest.fn(),
        getClass: jest.fn(),
        switchToHttp: () => ({
          getRequest: () => ({
            user:
              userRoles !== undefined
                ? { id: 'u1', email: 'test@example.com', roles: userRoles }
                : null,
          }),
        }),
      } as unknown as ExecutionContext;
    };

    it('should allow ADMIN to access product endpoints', () => {
      const context = createMockContext(['admin']);
      expect(rolesGuard.canActivate(context)).toBe(true);
    });

    it('should block AFFILIATE with ForbiddenException', () => {
      const context = createMockContext(['affiliate']);
      expect(() => rolesGuard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('should block CLIENT with ForbiddenException', () => {
      const context = createMockContext(['client']);
      expect(() => rolesGuard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('should block unauthenticated request with ForbiddenException', () => {
      const context = createMockContext(undefined);
      expect(() => rolesGuard.canActivate(context)).toThrow(ForbiddenException);
    });
  });
});
