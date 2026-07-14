export interface QualityIssue {
  id: string;
  message: string;
}

export interface QualityResult {
  /** 0-100 overall score shown to the seller */
  score: number;
  sharpness: number;
  resolution: number;
  framing: number;
  issues: QualityIssue[];
}
