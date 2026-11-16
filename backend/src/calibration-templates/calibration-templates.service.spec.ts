import { Test, TestingModule } from '@nestjs/testing';
import { CalibrationTemplatesService } from './calibration-templates.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CalibrationTemplate } from './entities/calibration-template.entity';
import { createMockRepository } from '../../test/utils/repository.mock';

describe('CalibrationTemplatesService', () => {
  let service: CalibrationTemplatesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CalibrationTemplatesService,
        {
          provide: getRepositoryToken(CalibrationTemplate),
          useValue: createMockRepository(),
        },
      ],
    }).compile();

    service = module.get<CalibrationTemplatesService>(CalibrationTemplatesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should reject template with invalid formula syntax', async () => {
    const invalidDto: any = {
      name: 'Test Template Broken Formula',
      layout_blocks: [
        {
          type: 'table_grid',
          title: 'Dimensions',
          columns: [{ id: 'error', label: 'Error', formula: 'reading + * 5' }],
        },
      ],
    };

    await expect(service.create(invalidDto)).rejects.toThrow(
      'Template contains invalid formula(s)',
    );
  });

  it('should accept template with valid formulas', async () => {
    const validDto: any = {
      name: 'Test Template Valid Formula',
      layout_blocks: [
        {
          type: 'table_grid',
          title: 'Dimensions',
          columns: [{ id: 'error', label: 'Error', formula: 'reading - nominal' }],
        },
      ],
    };

    const result = await service.create(validDto);
    expect(result).toBeDefined();
  });
});
