const FACTORIAL_BASE_URL = 'https://api.factorialhr.com/api/v1';

export class FactorialClient {
  private apiKey: string;
  private workspaceId: string;

  constructor() {
    this.apiKey = import.meta.env.VITE_FACTORIAL_API_KEY || '';
    this.workspaceId = import.meta.env.VITE_FACTORIAL_WORKSPACE_ID || '';

    if (!this.apiKey || !this.workspaceId) {
      console.warn('Factorial credentials not configured');
    }
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${FACTORIAL_BASE_URL}${endpoint}`;
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Factorial API Error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  // ==================== EMPLOYEES ====================
  
  async getEmployees() {
    return this.request<any[]>('/employees');
  }

  async getEmployee(id: string) {
    return this.request<any>(`/employees/${id}`);
  }

  async createEmployee(data: {
    email: string;
    first_name: string;
    last_name: string;
    birthday_on?: string;
    identifier?: string;
    role?: string;
  }) {
    return this.request<any>('/employees', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateEmployee(id: string, data: any) {
    return this.request<any>(`/employees/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // ==================== SHIFTS (TURNOS) ====================
  
  async getShifts(params?: {
    employee_id?: string;
    start_date?: string;
    end_date?: string;
  }) {
    const queryParams = new URLSearchParams(params as any).toString();
    return this.request<any[]>(`/shifts${queryParams ? '?' + queryParams : ''}`);
  }

  async createShift(data: {
    employee_id: string;
    day: string; // YYYY-MM-DD
    clock_in: string; // HH:MM
    clock_out: string; // HH:MM
  }) {
    return this.request<any>('/shifts', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async createShiftsBulk(shifts: Array<{
    employee_id: string;
    day: string;
    clock_in: string;
    clock_out: string;
  }>) {
    // Factorial no tiene endpoint bulk, crear uno por uno
    const results = [];
    for (const shift of shifts) {
      try {
        const result = await this.createShift(shift);
        results.push({ success: true, data: result });
      } catch (error) {
        results.push({ success: false, error: (error as Error).message });
      }
    }
    return results;
  }

  // ==================== ATTENDANCE (FICHAJES) ====================
  
  async getAttendance(params?: {
    employee_id?: string;
    from?: string;
    to?: string;
  }) {
    const queryParams = new URLSearchParams(params as any).toString();
    return this.request<any[]>(`/attendance/shifts${queryParams ? '?' + queryParams : ''}`);
  }

  async createAttendance(data: {
    employee_id: string;
    clock_in: string; // ISO 8601
    clock_out?: string; // ISO 8601
  }) {
    return this.request<any>('/attendance/shifts', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // ==================== TIME OFF (AUSENCIAS) ====================
  
  async getTimeOff(params?: {
    employee_id?: string;
    start_on?: string;
    finish_on?: string;
  }) {
    const queryParams = new URLSearchParams(params as any).toString();
    return this.request<any[]>(`/time_off${queryParams ? '?' + queryParams : ''}`);
  }

  async createTimeOff(data: {
    employee_id: string;
    start_on: string; // YYYY-MM-DD
    finish_on: string; // YYYY-MM-DD
    time_off_type_id: string;
    description?: string;
  }) {
    return this.request<any>('/time_off', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async approveTimeOff(id: string) {
    return this.request<any>(`/time_off/${id}/approve`, {
      method: 'POST',
    });
  }

  // ==================== DOCUMENTS ====================
  
  async getEmployeeDocuments(employeeId: string) {
    return this.request<any[]>(`/employees/${employeeId}/documents`);
  }

  async uploadEmployeeDocument(employeeId: string, file: File) {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(
      `${FACTORIAL_BASE_URL}/employees/${employeeId}/documents`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: formData,
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to upload document: ${response.statusText}`);
    }

    return response.json();
  }
}

// Exportar instancia singleton
export const factorial = new FactorialClient();
