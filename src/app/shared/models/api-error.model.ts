export interface ApiError {
  statusCode: number;
  path: string;
  timestamp: string;
  message: string | string[];
}
