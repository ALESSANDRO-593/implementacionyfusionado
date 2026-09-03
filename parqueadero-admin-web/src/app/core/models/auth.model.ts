export interface SessionUser {
  id: number;
  identification: string;
  fullName: string;
  email: string;
  role: string;
  permissions: string[];
}

export interface LoginRequest {
  cedula: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  expiresIn: number;
  user: SessionUser;
}
