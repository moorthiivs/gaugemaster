import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { CalibrationTemplatesService } from './calibration-templates.service';
import { CalibrationTemplate } from './entities/calibration-template.entity';

describe('CalibrationTemplatesService - Bulk Remove & Validation', () => {
  let service: CalibrationTemplatesService;
  let mockRepository: any;

  beforeEach(async () => {
    mockRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      findBy: jest.fn(),
      remove: jest.fn(),
      createQueryBuilder: jest.fn(),
      manager: {
        query: jest.fn(),
        transaction: jest.fn(async (cb) => cb({ remove: jest.fn() })),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CalibrationTemplatesService,
        {
          provide: getRepositoryToken(CalibrationTemplate),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<CalibrationTemplatesService>(CalibrationTemplatesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('bulkRemove validation', () => {
    it('should throw BadRequestException if ids array is empty', async () => {
      await expect(service.bulkRemove({ ids: [] })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException if no templates match the given IDs', async () => {
      mockRepository.findBy.mockResolvedValue([]);

      await expect(
        service.bulkRemove({ ids: ['00000000-0000-0000-0000-000000000001'] }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject deleting system templates for non-superadmin users', async () => {
      mockRepository.findBy.mockResolvedValue([
        { id: '1', name: 'System Default Template', companyId: null },
      ]);

      await expect(
        service.bulkRemove(
          { ids: ['1'] },
          { isSuperAdmin: false, companyId: 'comp-1' },
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject deleting other organization templates for non-superadmin users', async () => {
      mockRepository.findBy.mockResolvedValue([
        { id: '1', name: 'Other Org Template', companyId: 'other-comp' },
      ]);

      await expect(
        service.bulkRemove(
          { ids: ['1'] },
          { isSuperAdmin: false, companyId: 'my-comp' },
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject when templates are in use by calibrations without force flag', async () => {
      mockRepository.findBy.mockResolvedValue([
        { id: 'tpl-1', name: 'Vernier Template', companyId: 'comp-1' },
      ]);
      mockRepository.manager.query.mockResolvedValue([
        { template_id: 'tpl-1', count: '5' },
      ]);

      await expect(
        service.bulkRemove(
          { ids: ['tpl-1'], force: false },
          { isSuperAdmin: false, companyId: 'comp-1' },
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should succeed when force flag is true even if referenced by calibrations', async () => {
      const template = { id: 'tpl-1', name: 'Vernier Template', companyId: 'comp-1' };
      mockRepository.findBy.mockResolvedValue([template]);
      mockRepository.manager.query.mockResolvedValue([
        { template_id: 'tpl-1', count: '5' },
      ]);

      const result = await service.bulkRemove(
        { ids: ['tpl-1'], force: true },
        { isSuperAdmin: false, companyId: 'comp-1' },
      );

      expect(result.success).toBe(true);
      expect(result.deletedCount).toBe(1);
    });

    it('should successfully bulk delete when all validations pass', async () => {
      const templates = [
        { id: 'tpl-1', name: 'Template 1', companyId: 'comp-1' },
        { id: 'tpl-2', name: 'Template 2', companyId: 'comp-1' },
      ];
      mockRepository.findBy.mockResolvedValue(templates);
      mockRepository.manager.query.mockResolvedValue([]);

      const result = await service.bulkRemove(
        { ids: ['tpl-1', 'tpl-2'] },
        { isSuperAdmin: false, companyId: 'comp-1' },
      );

      expect(result.success).toBe(true);
      expect(result.deletedCount).toBe(2);
      expect(mockRepository.manager.transaction).toHaveBeenCalled();
    });
  });

  describe('single remove validation', () => {
    it('should prevent non-superadmin from deleting system template', async () => {
      const uuid = '00000000-0000-0000-0000-000000000001';
      mockRepository.findOne.mockResolvedValue({
        id: uuid,
        name: 'System Template',
        companyId: null,
      });

      await expect(
        service.remove(uuid, { isSuperAdmin: false, companyId: 'comp-1' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should prevent non-superadmin from deleting template of another company', async () => {
      const uuid = '00000000-0000-0000-0000-000000000002';
      mockRepository.findOne.mockResolvedValue({
        id: uuid,
        name: 'Company B Template',
        companyId: 'company-b',
      });

      await expect(
        service.remove(uuid, { isSuperAdmin: false, companyId: 'company-a' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});

