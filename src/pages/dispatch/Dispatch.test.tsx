import axios, { AxiosHeaders, type AxiosResponse } from 'axios';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Dispatch from './Dispatch';

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
const response = <T,>(data: T): AxiosResponse<T> => ({
  data,
  status: 200,
  statusText: 'OK',
  headers: new AxiosHeaders(),
  config: { headers: new AxiosHeaders() },
});

const renderDispatch = () => render(
  <MemoryRouter>
    <Dispatch />
  </MemoryRouter>,
);

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('hbus_user_role', 'A');
  localStorage.setItem('hbus_selected_location_id', 'loc-1');
  vi.clearAllMocks();
  vi.mocked(axios.get).mockImplementation(async (url) => {
    if (url.endsWith('/api/location')) return response([{ _id: 'loc-1', name: 'Main' }]);
    if (url.endsWith('/api/items/location/loc-1')) return response([]);
    return response([]);
  });
});

describe('dispatch additional fields', () => {
  it('sends the optional API fields when creating a dispatch', async () => {
    vi.mocked(axios.post).mockResolvedValue(response({}));
    renderDispatch();

    await screen.findByRole('option', { name: 'Main' });
    await screen.findByText('No dispatch records found.');
    fireEvent.click(screen.getByRole('button', { name: /Create new/ }));

    fireEvent.change(screen.getByLabelText('Type *'), { target: { value: 'PRIMARY' } });
    fireEvent.change(screen.getByLabelText('Challan number *'), { target: { value: 'CH-10' } });
    fireEvent.change(screen.getByLabelText('Date of delivery *'), { target: { value: '2026-11-18' } });
    fireEvent.change(screen.getByLabelText('Description *'), { target: { value: 'Dispatch test' } });
    fireEvent.change(screen.getByLabelText('TRWR print status'), { target: { value: 'Printed' } });
    fireEvent.change(screen.getByLabelText('NEW2'), { target: { value: 'New order' } });
    fireEvent.change(screen.getByLabelText('REP2'), { target: { value: 'Repair' } });
    fireEvent.change(screen.getByLabelText('Remarks 2'), { target: { value: 'Second note' } });
    fireEvent.change(screen.getByLabelText('Receiving copy status'), { target: { value: 'Received' } });
    fireEvent.change(screen.getByLabelText('Purchase order number 2'), { target: { value: 'PO-2' } });
    fireEvent.change(screen.getByLabelText('Purchase order date 2'), { target: { value: '2026-11-16' } });
    fireEvent.change(screen.getByLabelText('Quantity 2'), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create dispatch' }));

    await waitFor(() => expect(axios.post).toHaveBeenCalledWith(
      `${apiBase}/api/dispatches`,
      expect.objectContaining({
        trwrprintstatus: 'Printed',
        NEW2: 'New order',
        REP2: 'Repair',
        remarks2: 'Second note',
        receivingcopystatus: 'Received',
        purchaseorderno2: 'PO-2',
        purchaseorderdate2: '2026-11-16',
        qty2: 5,
      }),
    ));
  });

  it('prefills additional fields and submits changes when editing a dispatch', async () => {
    const record = {
      _id: 'dispatch-1',
      challanNo: 'CH-10',
      dateOfDelivery: '2026-11-18',
      type: 'PRIMARY',
      description: 'Dispatch test',
      location: 'loc-1',
      trwrprintstatus: 'Printed',
      NEW2: 'New order',
      REP2: 'Repair',
      remarks2: 'Second note',
      receivingcopystatus: 'Received',
      purchaseorderno2: 'PO-2',
      purchaseorderdate2: '2026-11-16',
      qty2: 3,
    };
    vi.mocked(axios.get).mockImplementation(async (url) => {
      if (url.endsWith('/api/location')) return response([{ _id: 'loc-1', name: 'Main' }]);
      if (url.endsWith('/api/dispatches/location/loc-1')) return response([record]);
      return response([]);
    });
    vi.mocked(axios.put).mockResolvedValue(response(record));
    renderDispatch();

    await screen.findByText('CH-10');
    fireEvent.click(screen.getByRole('button', { name: 'Edit dispatch' }));

    await waitFor(() => {
      expect(screen.getByLabelText('TRWR print status')).toHaveProperty('value', 'Printed');
      expect(screen.getByLabelText('Quantity 2')).toHaveProperty('value', '3');
    });
    fireEvent.change(screen.getByLabelText('Quantity 2'), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(axios.put).toHaveBeenCalledWith(
      `${apiBase}/api/dispatches/dispatch-1`,
      expect.objectContaining({
        trwrprintstatus: 'Printed',
        NEW2: 'New order',
        REP2: 'Repair',
        remarks2: 'Second note',
        receivingcopystatus: 'Received',
        purchaseorderno2: 'PO-2',
        purchaseorderdate2: '2026-11-16',
        qty2: 5,
      }),
    ));
  });
});
