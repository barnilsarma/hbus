import axios, { AxiosHeaders, type AxiosResponse } from 'axios';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Home from './Home';

vi.mock('axios', async (importOriginal) => {
  const actual = await importOriginal<typeof import('axios')>();
  return {
    ...actual,
    default: {
      ...actual.default,
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
      isAxiosError: vi.fn(() => false),
    },
  };
});

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    promise: vi.fn(),
  },
}));

vi.mock('../../firebase.ts', () => ({
  signInWithGoogle: vi.fn(),
  signOutGoogle: vi.fn(),
}));

const apiBase = import.meta.env.VITE_APP_API;

const response = <T,>(data: T): AxiosResponse<T> => ({
  data,
  status: 200,
  statusText: 'OK',
  headers: new AxiosHeaders(),
  config: { headers: new AxiosHeaders() },
});

const StockDestination = () => {
  const { resource } = useParams();
  return <p>Selected stock resource: {resource}</p>;
};

const stockLabels = [
  'LIVE STOCK',
  'ORDER ENTRY',
  'INVOICE',
  'INVOICE PO',
  'REJECTION STOCK',
  'REJECTION ENTRY',
  'DAILY PRODUCTION REPORT STOCK',
  'DAILY PRODUCTION',
  'PER JOB DATA',
  'STOCK ADJUSTMENT ENTRY',
  'PRODUCTION FLOOR',
  'REPAIRING DATA',
  'REPAIRING DATA RETURN STOCK',
  'REPAIRING DATA REPAIRING STOCK',
];

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('hbus_user_logged_in', 'true');
  localStorage.setItem('hbus_user_role', 'A');
  localStorage.setItem('hbus_user_id', 'user-1');
  vi.clearAllMocks();
  vi.mocked(axios.get).mockResolvedValue(response({ role: 'A', viewaccess: [], editaccess: [] }));
});

describe('homepage stock navigation', () => {
  it('shows direct links for all stock resources and no generic Stock link', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/stock/:resource" element={<StockDestination />} />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByRole('button', { name: 'LIVE STOCK' });
    for (const label of stockLabels) {
      expect(screen.getByRole('button', { name: label })).toBeTruthy();
    }
    expect(screen.queryByRole('button', { name: 'STOCK' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'ORDER ENTRY' }));
    expect(await screen.findByText('Selected stock resource: order-entries')).toBeTruthy();
    expect(axios.get).toHaveBeenCalledWith(`${apiBase}/api/users/user-1`);
  });
});
