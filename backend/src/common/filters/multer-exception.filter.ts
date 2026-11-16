import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { MulterError } from 'multer';

@Catch(MulterError)
export class MulterExceptionFilter implements ExceptionFilter {
  catch(exception: MulterError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.BAD_REQUEST;
    let message = 'File upload error';

    if (exception.code === 'LIMIT_FILE_SIZE') {
      status = HttpStatus.PAYLOAD_TOO_LARGE;
      message = 'File size exceeds maximum allowed limit of 50MB. Please select a file under 50MB.';
    } else if (exception.code === 'LIMIT_UNEXPECTED_FILE') {
      status = HttpStatus.BAD_REQUEST;
      message = `Unexpected file field: ${exception.field || 'unknown'}`;
    } else {
      message = exception.message || 'File upload failed';
    }

    response.status(status).json({
      statusCode: status,
      error: status === HttpStatus.PAYLOAD_TOO_LARGE ? 'Payload Too Large' : 'Bad Request',
      message,
    });
  }
}

