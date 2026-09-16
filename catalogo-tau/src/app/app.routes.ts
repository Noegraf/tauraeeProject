import { Routes } from '@angular/router';
import { Admin } from './admin/admin';
import { Catalogo } from './catalogo/catalogo';

export const routes: Routes = [
	{ path: '', component: Catalogo },
	{ path: 'admin', component: Admin },
	{ path: '**', redirectTo: '' },
];
