import { HttpContextToken } from '@angular/common/http';

export const IS_CONNECTION_PROBE = new HttpContextToken<boolean>(() => false);
