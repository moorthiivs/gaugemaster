import { PartialType } from '@nestjs/mapped-types';
import { CreateInstrumentDto } from './create-instrument.dto';
import { IsOptional } from 'class-validator';

export class UpdateInstrumentDto extends PartialType(CreateInstrumentDto) {
    @IsOptional()
    previous_last_calibration_date?: string | Date;
}
