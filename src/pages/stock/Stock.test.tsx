import axios, { AxiosHeaders, type AxiosResponse } from 'axios';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Stock from './Stock';

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

vi.mock('../../components/DepartmentAccessManager', () => ({ default: () => null }));

const apiBase = import.meta.env.VITE_APP_API;
const stockEndpoint = `${apiBase}/api/stock`;

const response = <T,>(data: T): AxiosResponse<T> => ({
  data,
  status: 200,
  statusText: 'OK',
  headers: new AxiosHeaders(),
  config: { headers: new AxiosHeaders() },
});

const renderStock = (resource: string) => render(
  <MemoryRouter initialEntries={[`/stock/${resource}`]}>
    <Routes>
      <Route path="/stock/:resource?" element={<Stock />} />
    </Routes>
  </MemoryRouter>,
);

const resources = [
  'livestocks',
  'order-entries',
  'invoices',
  'invoice-pos',
  'rejection-stocks',
  'rejection-entries',
  'daily-prod-report-stocks',
  'daily-prods',
  'per-job-data',
  'stock-adjustment-entries',
  'production-flor',
  'repairing-data',
  'repairing-data-return-stocks',
  'repairing-data-repairing-stocks',
];

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('hbus_user_role', 'A');
  vi.clearAllMocks();
});

describe('stock resource lists', () => {
  it.each(resources)('loads %s from its stock API route', async (resource) => {
    vi.mocked(axios.get).mockResolvedValue(response([]));

    renderStock(resource);

    await screen.findByText('No records found.');
    expect(axios.get).toHaveBeenCalledWith(`${stockEndpoint}/${resource}`);
  });
});

describe('stock record actions', () => {
  it('creates a Live Stock record from the popup form', async () => {
    vi.mocked(axios.get).mockResolvedValue(response([]));
    vi.mocked(axios.post).mockResolvedValue(response({}));
    renderStock('livestocks');

    await screen.findByText('No records found.');
    fireEvent.click(screen.getByRole('button', { name: 'New record' }));
    fireEvent.change(screen.getByLabelText('kva *'), { target: { value: '100' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create record' }));

    await waitFor(() => expect(axios.post).toHaveBeenCalledWith(
      `${stockEndpoint}/livestocks`,
      expect.objectContaining({ kva: '100' }),
    ));
  });

  it('loads a record before editing and sends the updated fields', async () => {
    const record = { _id: 'live-1', kva: '100', codeCore: 'CORE-1', looseCoreOrderedKG: 25 };
    vi.mocked(axios.get).mockImplementation(async (url) => (
      url.endsWith('/live-1') ? response(record) : response([record])
    ));
    vi.mocked(axios.put).mockResolvedValue(response(record));
    renderStock('livestocks');

    await screen.findByText('100');
    fireEvent.click(screen.getByRole('button', { name: 'Edit Live Stock' }));
    await screen.findByRole('heading', { name: 'Edit Live Stock' });

    expect(screen.queryByLabelText('looseCoreOrderedKG')).toBeNull();
    fireEvent.change(screen.getByLabelText('kva *'), { target: { value: '150' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(axios.put).toHaveBeenCalledWith(
      `${stockEndpoint}/livestocks/live-1`,
      expect.objectContaining({ kva: '150' }),
    ));
    expect(axios.get).toHaveBeenCalledWith(`${stockEndpoint}/livestocks/live-1`);
  });

  it('deletes a record after confirmation', async () => {
    const record = { _id: 'live-1', kva: '100' };
    vi.mocked(axios.get).mockResolvedValue(response([record]));
    vi.mocked(axios.delete).mockResolvedValue(response(undefined));
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderStock('livestocks');

    await screen.findByText('100');
    fireEvent.click(screen.getByRole('button', { name: 'Delete Live Stock' }));

    await waitFor(() => expect(axios.delete).toHaveBeenCalledWith(
      `${stockEndpoint}/livestocks/live-1`,
    ));
    expect(window.confirm).toHaveBeenCalled();
  });

  it('uses the quantity patch endpoint for Order Entry quantity changes', async () => {
    const record = { _id: 'order-1', material: 'CORE', kva: '100', code: 'CORE-100', qty: 4 };
    vi.mocked(axios.get).mockResolvedValue(response([record]));
    vi.mocked(axios.patch).mockResolvedValue(response({ ...record, qty: 8 }));
    renderStock('order-entries');

    await screen.findByText('CORE-100');
    fireEvent.click(screen.getByRole('button', { name: 'Update quantity' }));
    fireEvent.change(screen.getByLabelText('New quantity'), { target: { value: '8' } });
    const updateButtons = screen.getAllByRole('button', { name: 'Update quantity' });
    fireEvent.click(updateButtons[1]);

    await waitFor(() => expect(axios.patch).toHaveBeenCalledWith(
      `${stockEndpoint}/order-entries/order-1/qty`,
      { new_qty: 8 },
    ));
  });
});

describe('stock access', () => {
  it('denies users without Stock view or edit access', async () => {
    localStorage.setItem('hbus_user_role', 'D');
    localStorage.setItem('hbus_user_id', 'user-1');
    vi.mocked(axios.get).mockResolvedValue(response({ viewaccess: [], editaccess: [] }));

    renderStock('livestocks');

    expect(await screen.findByText('Stock access required')).toBeTruthy();
    expect(axios.get).toHaveBeenCalledWith(`${apiBase}/api/users/user-1`);
    expect(axios.get).not.toHaveBeenCalledWith(`${stockEndpoint}/livestocks`);
  });

  it('lets view-only users read records without edit controls', async () => {
    localStorage.setItem('hbus_user_role', 'D');
    localStorage.setItem('hbus_user_id', 'user-1');
    localStorage.setItem('hbus_user_viewaccess', JSON.stringify(['Stock']));
    vi.mocked(axios.get).mockImplementation(async (url) => (
      url.endsWith('/api/users/user-1')
        ? response({ viewaccess: ['Stock'], editaccess: [] })
        : response([{ _id: 'live-1', kva: '100' }])
    ));
    renderStock('livestocks');

    await screen.findByText('100');
    expect(screen.queryByRole('button', { name: 'New record' })).toBeNull();
    expect(screen.queryByRole('columnheader', { name: 'Actions' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Edit Live Stock' })).toBeNull();
  });

  it('allows edit access to view and manage records', async () => {
    localStorage.setItem('hbus_user_role', 'D');
    localStorage.setItem('hbus_user_id', 'user-1');
    localStorage.setItem('hbus_user_editaccess', JSON.stringify(['Stock']));
    vi.mocked(axios.get).mockImplementation(async (url) => (
      url.endsWith('/api/users/user-1')
        ? response({ viewaccess: [], editaccess: ['Stock'] })
        : response([])
    ));
    renderStock('livestocks');

    await screen.findByText('No records found.');
    expect(screen.getByRole('button', { name: 'New record' })).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'Actions' })).toBeTruthy();
  });
});
