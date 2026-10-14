import axios from 'axios';
import { useCallback, useEffect, useState } from 'react';
import type React from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { FaArrowLeft, FaMapMarkerAlt, FaPlus, FaTimes } from 'react-icons/fa';
import styles from './Dispatch.module.scss';

type Location = {
  _id?: string;
  id?: string;
  name?: string;
};

type DispatchRecord = {
  _id?: string;
  id?: string;
  challanNo: string;
  invoiceNo: string;
  dateOfDelivery: string;
  type: string;
  description: string;
  new?: string;
  REP?: string;
  DTRSerialNo?: string;
  rate?: number;
  gstno?: string;
  vehicleDetails?: string;
  partyName?: string;
  destination?: string;
  location?: string | Location;
};

type DispatchForm = {
  challanNo: string;
  invoiceNo: string;
  dateOfDelivery: string;
  type: string;
  description: string;
  new: string;
  REP: string;
  DTRSerialNo: string;
  rate: string;
  gstno: string;
  vehicleDetails: string;
  partyName: string;
  destination: string;
};

const emptyForm: DispatchForm = {
  challanNo: '',
  invoiceNo: '',
  dateOfDelivery: '',
  type: '',
  description: '',
  new: '',
  REP: '',
  DTRSerialNo: '',
  rate: '',
  gstno: '',
  vehicleDetails: '',
  partyName: '',
  destination: '',
};

const getResponseData = (data: unknown): unknown => {
  let result = data;
  while (result && typeof result === 'object' && !Array.isArray(result)) {
    const envelope = result as Record<string, unknown>;
    const nested = envelope.data ?? envelope.dispatches ?? envelope.dispatch;
    if (nested === undefined || nested === result) break;
    result = nested;
  }
  return result;
};

const getId = (value: unknown): string | null => {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') {
    const entity = value as { _id?: unknown; id?: unknown };
    return (typeof entity._id === 'string' && entity._id) ||
      (typeof entity.id === 'string' && entity.id) || null;
  }
  return null;
};

const getLocationName = (location: DispatchRecord['location']) =>
  typeof location === 'object' && location !== null
    ? location.name || getId(location) || '-'
    : location || '-';

const formatDate = (value: string | undefined) => {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-GB');
};

export default function Dispatch() {
  const isTypeA = localStorage.getItem('hbus_user_role') === 'A';
  const [records, setRecords] = useState<DispatchRecord[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState(
    () => (isTypeA ? localStorage.getItem('hbus_selected_location_id') || 'ALL' : ''),
  );
  const currentUserId = localStorage.getItem('hbus_user_id') || localStorage.getItem('userId');
  const [userLocationId, setUserLocationId] = useState('');
  const [loading, setLoading] = useState(isTypeA || Boolean(currentUserId));
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<DispatchForm>(emptyForm);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isTypeA) return;
    axios.get(`${import.meta.env.VITE_APP_API}/api/location`)
      .then((response) => {
        const data = getResponseData(response.data);
        if (!Array.isArray(data)) throw new Error('Location response was not a list.');
        setLocations(data as Location[]);
      })
      .catch((requestError) => {
        console.error('Failed to load dispatch locations.', requestError);
        toast.error('Failed to load locations.');
      });
  }, [isTypeA]);

  useEffect(() => {
    if (isTypeA) return;
    if (!currentUserId) return;

    let active = true;
    axios.get(`${import.meta.env.VITE_APP_API}/api/users/${currentUserId}`)
      .then((response) => {
        const locationId = getId(response.data?.location);
        if (!locationId) throw new Error('No saved location is assigned to this user.');
        if (active) {
          setUserLocationId(locationId);
          setSelectedLocationId(locationId);
        }
      })
      .catch((requestError) => {
        console.error('Failed to load the user location for dispatches.', requestError);
        if (active) {
          setError('Unable to load your saved location.');
          setLoading(false);
          toast.error('Unable to load your saved location.');
        }
      });
    return () => {
      active = false;
    };
  }, [currentUserId, isTypeA]);

  const loadDispatches = useCallback(async () => {
    if (!isTypeA && !userLocationId) return;
    const locationId = isTypeA ? selectedLocationId : userLocationId;
    if (!locationId) return;

    try {
      const endpoint = locationId === 'ALL'
        ? '/api/dispatches'
        : `/api/dispatches/location/${encodeURIComponent(locationId)}`;
      const response = await axios.get(`${import.meta.env.VITE_APP_API}${endpoint}`);
      const data = getResponseData(response.data);
      if (!Array.isArray(data)) throw new Error('Dispatch response was not a list.');
      setError(null);
      setRecords(data as DispatchRecord[]);
    } catch (requestError) {
      console.error('Failed to load dispatch records.', requestError);
      setRecords([]);
      setError('Unable to load dispatch records. Please try again.');
      toast.error('Failed to load dispatch records.');
    } finally {
      setLoading(false);
    }
  }, [isTypeA, selectedLocationId, userLocationId]);

  useEffect(() => {
    void Promise.resolve().then(loadDispatches);
  }, [loadDispatches]);

  const changeLocation = (locationId: string) => {
    setSelectedLocationId(locationId);
    setLoading(true);
    setError(null);
    if (locationId === 'ALL') {
      localStorage.removeItem('hbus_selected_location_id');
    } else {
      localStorage.setItem('hbus_selected_location_id', locationId);
    }
  };

  const openCreateForm = () => {
    if (!selectedLocationId || selectedLocationId === 'ALL') {
      toast.error('Select a specific location before creating a dispatch.');
      return;
    }
    setForm(emptyForm);
    setModalOpen(true);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const locationId = isTypeA ? selectedLocationId : userLocationId;
    if (!locationId || locationId === 'ALL') {
      toast.error('Select a specific location before creating a dispatch.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        rate: form.rate === '' ? undefined : Number(form.rate),
        location: locationId,
      };
      await axios.post(`${import.meta.env.VITE_APP_API}/api/dispatches`, payload);
      toast.success('Dispatch created successfully.');
      setModalOpen(false);
      await loadDispatches();
    } catch (requestError) {
      console.error('Failed to create dispatch.', requestError);
      const message = axios.isAxiosError(requestError)
        ? requestError.response?.data?.message || 'Failed to create dispatch.'
        : 'Failed to create dispatch.';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const setField = <Field extends keyof DispatchForm>(field: Field, value: DispatchForm[Field]) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>DISPATCH MANAGEMENT</p>
            <h1>Dispatches</h1>
            <p className={styles.subtitle}>Review delivery records and generate challans.</p>
          </div>
          <div className={styles.actions}>
            {isTypeA && (
              <label className={styles.locationControl}>
                <FaMapMarkerAlt aria-hidden="true" />
                <span className={styles.visuallyHidden}>Choose location</span>
                <select value={selectedLocationId} onChange={(event) => changeLocation(event.target.value)}>
                  <option value="ALL">All locations</option>
                  {locations.map((location) => {
                    const locationId = getId(location);
                    return locationId ? (
                      <option key={locationId} value={locationId}>{location.name || locationId}</option>
                    ) : null;
                  })}
                </select>
              </label>
            )}
            <button type="button" className={styles.primaryButton} onClick={openCreateForm}>
              <FaPlus aria-hidden="true" /> Create new
            </button>
            <Link to="/" className={styles.secondaryButton}><FaArrowLeft aria-hidden="true" /> Home</Link>
          </div>
        </header>

        {(error || (!isTypeA && !currentUserId ? 'Your user account could not be identified.' : null)) && (
          <div className={styles.error} role="alert">
            {error || 'Your user account could not be identified.'}
          </div>
        )}

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Challan No.</th>
                <th>Invoice No.</th>
                <th>Delivery Date</th>
                <th>Type</th>
                <th>Description</th>
                <th>Party</th>
                <th>Location</th>
                <th>Challan</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className={styles.emptyState}>Loading dispatches...</td></tr>
              ) : records.length === 0 ? (
                <tr><td colSpan={8} className={styles.emptyState}>No dispatch records found.</td></tr>
              ) : records.map((record, index) => {
                const recordId = getId(record);
                return (
                  <tr key={recordId || `${record.challanNo}-${index}`}>
                    <td className={styles.strongCell}>{record.challanNo || '-'}</td>
                    <td>{record.invoiceNo || '-'}</td>
                    <td>{formatDate(record.dateOfDelivery)}</td>
                    <td><span className={styles.typeBadge}>{record.type}</span></td>
                    <td className={styles.descriptionCell}>{record.description || '-'}</td>
                    <td>{record.partyName || '-'}</td>
                    <td>{getLocationName(record.location)}</td>
                    <td>
                      {recordId ? (
                        <Link className={styles.challanButton} to={`/dispatch/${recordId}`}>Generate challan</Link>
                      ) : 'Unavailable'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {modalOpen && (
        <div className={styles.modalOverlay} onMouseDown={(event) => {
          if (event.target === event.currentTarget && !saving) setModalOpen(false);
        }}>
          <section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="dispatch-form-title">
            <header className={styles.modalHeader}>
              <div>
                <p className={styles.eyebrow}>NEW RECORD</p>
                <h2 id="dispatch-form-title">Create dispatch</h2>
              </div>
              <button type="button" className={styles.closeButton} aria-label="Close form" onClick={() => setModalOpen(false)}>
                <FaTimes aria-hidden="true" />
              </button>
            </header>
            <form onSubmit={handleSubmit}>
              <div className={styles.formGrid}>
                <label>Type *
                  <input required value={form.type} onChange={(event) => setField('type', event.target.value)} />
                </label>
                <label>Challan number *
                  <input required value={form.challanNo} onChange={(event) => setField('challanNo', event.target.value)} />
                </label>
                <label>Invoice number
                  <input value={form.invoiceNo} onChange={(event) => setField('invoiceNo', event.target.value)} />
                </label>
                <label>Date of delivery *
                  <input type="date" required value={form.dateOfDelivery} onChange={(event) => setField('dateOfDelivery', event.target.value)} />
                </label>
                <label className={styles.fullWidth}>Description *
                  <textarea required rows={3} value={form.description} onChange={(event) => setField('description', event.target.value)} />
                </label>
                <label>New
                  <input value={form.new} onChange={(event) => setField('new', event.target.value)} />
                </label>
                <label>REP
                  <input value={form.REP} onChange={(event) => setField('REP', event.target.value)} />
                </label>
                <label>DTR serial number
                  <input value={form.DTRSerialNo} onChange={(event) => setField('DTRSerialNo', event.target.value)} />
                </label>
                <label>Rate
                  <input type="number" min="0" step="any" value={form.rate} onChange={(event) => setField('rate', event.target.value)} />
                </label>
                <label>GST number
                  <input value={form.gstno} onChange={(event) => setField('gstno', event.target.value)} />
                </label>
                <label>Vehicle details *
                  <input value={form.vehicleDetails} onChange={(event) => setField('vehicleDetails', event.target.value)} />
                </label>
                <label>Party name   
                  <input value={form.partyName} onChange={(event) => setField('partyName', event.target.value)} />
                </label>
                <label>Destination *
                  <input value={form.destination} onChange={(event) => setField('destination', event.target.value)} />
                </label>
              </div>
              <footer className={styles.modalActions}>
                <button type="button" className={styles.secondaryButton} disabled={saving} onClick={() => setModalOpen(false)}>Cancel</button>
                <button type="submit" className={styles.primaryButton} disabled={saving}>
                  <FaPlus aria-hidden="true" /> {saving ? 'Creating...' : 'Create dispatch'}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
