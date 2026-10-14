import axios from 'axios';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { FaArrowLeft, FaPrint } from 'react-icons/fa';
import styles from './DispatchDetail.module.scss';

type Location = string | { _id?: string; id?: string; name?: string; address?: string; gstn?: string };
type DispatchRecord = {
  _id?: string;
  id?: string;
  challanNo?: string;
  invoiceNo?: string;
  dateOfDelivery?: string;
  type?: 'PRIMARY' | 'SECONDARY';
  description?: string;
  new?: string;
  REP?: string;
  DTRSerialNo?: string;
  rate?: number;
  gstno?: string;
  vehicleDetails?: string;
  partyName?: string;
  destination?: string;
  location?: Location;
};

const getResponseData = (data: unknown): DispatchRecord => {
  let result = data;
  while (result && typeof result === 'object' && !Array.isArray(result)) {
    const envelope = result as Record<string, unknown>;
    const nested = envelope.data ?? envelope.dispatch;
    if (nested === undefined || nested === result) break;
    result = nested;
  }
  return result as DispatchRecord;
};

const displayValue = (value: unknown) =>
  value === undefined || value === null || value === '' ? '-' : String(value);

const formatDate = (value?: string) => {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-GB');
};

export default function DispatchDetail() {
  const { id } = useParams();
  const [record, setRecord] = useState<DispatchRecord | null>(null);
  const [loading, setLoading] = useState(Boolean(id));

  useEffect(() => {
    if (!id) {
      toast.error('Dispatch record ID is missing.');
      return;
    }
    let active = true;
    axios.get(`${import.meta.env.VITE_APP_API}/api/dispatches/${encodeURIComponent(id)}`)
      .then((response) => {
        if (active) setRecord(getResponseData(response.data));
      })
      .catch((error) => {
        console.error('Failed to load dispatch details.', error);
        if (active) toast.error('Failed to load dispatch details.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);

  if (loading) return <main className={styles.loading}>Loading dispatch challan...</main>;
  if (!record) {
    return (
      <main className={styles.page}>
        <p className={styles.notFound}>Dispatch record not found.</p>
        <Link to="/dispatch" className={styles.backButton}><FaArrowLeft aria-hidden="true" /> Back to dispatches</Link>
      </main>
    );
  }

  const location = typeof record.location === 'object' && record.location !== null
    ? record.location
    : undefined;
  const locationName = location?.name || location?.address || (typeof record.location === 'string' ? record.location : '-');

  return (
    <main className={styles.page}>
      <nav className={`${styles.toolbar} ${styles.noPrint}`}>
        <Link to="/dispatch" className={styles.backButton}><FaArrowLeft aria-hidden="true" /> Back to dispatches</Link>
        <button type="button" className={styles.printButton} onClick={() => window.print()}>
          <FaPrint aria-hidden="true" /> Print challan
        </button>
      </nav>
      <article className={styles.challan}>
        <header className={styles.documentHeader}>
          <div>
            <p className={styles.company}>HBUS</p>
            <p className={styles.tagline}>Equipment Manufacturing Company</p>
          </div>
          <div className={styles.documentType}>
            <p>GOODS DISPATCH</p>
            <h1>DELIVERY CHALLAN</h1>
            <span>{displayValue(record.type)}</span>
          </div>
        </header>

        <section className={styles.numberGrid}>
          <div><span>Challan No.</span><strong>{displayValue(record.challanNo)}</strong></div>
          <div><span>Invoice No.</span><strong>{displayValue(record.invoiceNo)}</strong></div>
          <div><span>Date of delivery</span><strong>{formatDate(record.dateOfDelivery)}</strong></div>
        </section>

        <section className={styles.partyGrid}>
          <div className={styles.infoBlock}>
            <h2>Consignee / Party</h2>
            <p className={styles.partyName}>{displayValue(record.partyName)}</p>
            <p>{displayValue(record.gstno)}</p>
          </div>
          <div className={styles.infoBlock}>
            <h2>Dispatch details</h2>
            <p><span>Location</span><strong>{locationName}</strong></p>
            <p><span>Destination</span><strong>{displayValue(record.destination)}</strong></p>
            <p><span>Vehicle</span><strong>{displayValue(record.vehicleDetails)}</strong></p>
          </div>
        </section>

        <section className={styles.descriptionBlock}>
          <h2>Goods / Description</h2>
          <p>{displayValue(record.description)}</p>
        </section>

        <table className={styles.detailsTable}>
          <thead>
            <tr><th>New</th><th>REP</th><th>DTR Serial No.</th><th>Rate</th></tr>
          </thead>
          <tbody>
            <tr>
              <td>{displayValue(record.new)}</td>
              <td>{displayValue(record.REP)}</td>
              <td>{displayValue(record.DTRSerialNo)}</td>
              <td>{record.rate === undefined ? '-' : Number(record.rate).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            </tr>
          </tbody>
        </table>

        <section className={styles.receipt}>
          <p>Received the above goods in good condition.</p>
          <div className={styles.signatureGrid}>
            <div><span>Receiver's signature</span></div>
            <div><span>Authorized signatory</span></div>
          </div>
        </section>
        <footer className={styles.documentFooter}>
          <span>Dispatch type: {displayValue(record.type)}</span>
          <span>Challan No.: {displayValue(record.challanNo)}</span>
        </footer>
      </article>
    </main>
  );
}
