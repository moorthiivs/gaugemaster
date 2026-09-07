import {
  IsArray,
  ArrayNotEmpty,
  ArrayMaxSize,
  IsUUID,
  IsOptional,
  IsBoolean,
} from 'class-validator';

export class BulkDeleteCalibrationTemplatesDto {
  @IsArray({ message: 'Template IDs must be provided as an array.' })
  @ArrayNotEmpty({ message: 'Please provide at least one template ID to delete.' })
  @ArrayMaxSize(100, { message: 'Cannot delete more than 100 templates in a single request.' })
  @IsUUID('all', { each: true, message: 'Each template ID must be a valid UUID.' })
  ids: string[];

  @IsOptional()
  @IsBoolean()
  force?: boolean;
}
