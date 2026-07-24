import { PartialType } from '@nestjs/mapped-types';
import { CreateCalibrationTemplateDto } from './create-calibration-template.dto';

export class UpdateCalibrationTemplateDto extends PartialType(
  CreateCalibrationTemplateDto,
) {}
