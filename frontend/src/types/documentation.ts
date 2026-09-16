export interface CalibrationProcedure {
  id: string;
  process: string;
  document_name?: string;
  file_type?: string;
  file_path?: string;
  version: number;
  description?: string;
  companyId?: string;
  created_by_id?: string;
  created_by_name?: string;
  updated_by_id?: string;
  updated_by_name?: string;
  created_at: string;
  updated_at: string;
}

export interface CalibrationProcedureHistory {
  id: string;
  procedure_id: string;
  process: string;
  document_name?: string;
  file_type?: string;
  file_path?: string;
  version: number;
  action_details?: string;
  created_by_id?: string;
  created_by_name?: string;
  companyId?: string;
  created_at: string;
}

export interface GaugeDiagram {
  id: string;
  gauge_name: string;
  id_code?: string;
  part_name?: string;
  instrument_id?: string;
  document_name?: string;
  file_type?: string;
  file_path?: string;
  version: number;
  description?: string;
  companyId?: string;
  created_by_id?: string;
  created_by_name?: string;
  updated_by_id?: string;
  updated_by_name?: string;
  created_at: string;
  updated_at: string;
}

export interface GaugeDiagramHistory {
  id: string;
  diagram_id: string;
  gauge_name: string;
  id_code?: string;
  part_name?: string;
  instrument_id?: string;
  document_name?: string;
  file_type?: string;
  file_path?: string;
  version: number;
  action_details?: string;
  created_by_id?: string;
  created_by_name?: string;
  companyId?: string;
  created_at: string;
}

export interface WorkInstruction {
  id: string;
  title: string;
  id_code?: string;
  part_name?: string;
  instrument_id?: string;
  document_name?: string;
  file_type?: string;
  file_path?: string;
  version: number;
  description?: string;
  companyId?: string;
  created_by_id?: string;
  created_by_name?: string;
  updated_by_id?: string;
  updated_by_name?: string;
  created_at: string;
  updated_at: string;
}

export interface WorkInstructionHistory {
  id: string;
  instruction_id: string;
  title: string;
  id_code?: string;
  part_name?: string;
  instrument_id?: string;
  document_name?: string;
  file_type?: string;
  file_path?: string;
  version: number;
  action_details?: string;
  created_by_id?: string;
  created_by_name?: string;
  companyId?: string;
  created_at: string;
}
