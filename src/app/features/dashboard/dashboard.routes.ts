import { Routes } from '@angular/router';
import {
  ArcElement,
  CategoryScale,
  Filler,
  Legend,
  LineController,
  LineElement,
  LinearScale,
  DoughnutController,
  PointElement,
  Tooltip,
} from 'chart.js';
import { provideCharts } from 'ng2-charts';
import { Dashboard } from './pages/dashboard/dashboard';

export const DASHBOARD_ROUTES: Routes = [
  {
    path: '',
    component: Dashboard,
    providers: [
      provideCharts({
        registerables: [
          LineController,
          DoughnutController,
          ArcElement,
          LineElement,
          PointElement,
          CategoryScale,
          LinearScale,
          Legend,
          Tooltip,
          Filler,
        ],
      }),
    ],
  },
];
