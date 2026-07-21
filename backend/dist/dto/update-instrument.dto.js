"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateInstrumentDto = void 0;
const mapped_types_1 = require("@nestjs/mapped-types");
const create_instrument_dto_1 = require("./create-instrument.dto");
class UpdateInstrumentDto extends (0, mapped_types_1.PartialType)(create_instrument_dto_1.CreateInstrumentDto) {
}
exports.UpdateInstrumentDto = UpdateInstrumentDto;
//# sourceMappingURL=update-instrument.dto.js.map