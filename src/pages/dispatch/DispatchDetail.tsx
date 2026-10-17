import axios from 'axios';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { FaArrowLeft, FaPrint } from 'react-icons/fa';
import styles from './DispatchDetail.module.scss';

type LocationObj = {
  _id?: string;
  id?: string;
  name?: string;
  address?: string;
  gstn?: string;
};

type ItemRef = {
  _id?: string;
  name?: string;
  mcode?: string;
  HSNCode?: string;
};

type AccessoryEntry = {
  _id?: string;
  item?: ItemRef | string;
  quantity?: number;
};

type DispatchRecord = {
  _id?: string;
  id?: string;
  challanNo?: string;
  invoiceNo?: string;
  dateOfDelivery?: string;
  type?: 'PRIMARY' | 'SECONDARY';
  description?: string;
  item?: ItemRef | string;
  quantity?: number;
  accessories?: AccessoryEntry[];
  HSNCode?: string;
  DTRSerialNo?: string;
  rate?: number;
  gstno?: string;
  vehicleDetails?: string;
  partyName?: string;
  destination?: string;
  location?: LocationObj | string;
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

  // Extract main item name and HSN code safely
  const mainItem = typeof record.item === 'object' && record.item !== null ? record.item : undefined;
  const itemName = mainItem?.name || record.description || '-';
  const itemHsn = record.HSNCode || mainItem?.HSNCode || '-';

  // Consignee location information
  const locationObj = typeof record.location === 'object' && record.location !== null ? record.location : undefined;
  const consigneeAddress = locationObj?.address || record.destination || '-';
  const consigneeGstn = record.gstno || locationObj?.gstn || '-';

  return (
    <main className={styles.page}>
      <nav className={`${styles.toolbar} ${styles.noPrint}`}>
        <Link to="/dispatch" className={styles.backButton}><FaArrowLeft aria-hidden="true" /> Back to dispatches</Link>
        <button type="button" className={styles.printButton} onClick={() => window.print()}>
          <FaPrint aria-hidden="true" /> Print challan
        </button>
      </nav>

      <article className={styles.challan}>
        {/* Header Header */}
        <header className={styles.documentHeader}>
          <div className={styles.brandTitle}>
            <span className={styles.brandHbus}>H-BUS</span>
            <span className={styles.brandCompany}>EQUIPMENT MANUFACTURING COMPANY</span>
          </div>
          <p className={styles.tagline}>A Synonym of Excellence</p>
          <p className={styles.addressSub}>Industrial Growth Centre, Matia, (Mornai), Goalpara, Assam, 783101</p>
        </header>

        <div className={styles.metaRow}>
          <span><strong>Challan No:</strong> {displayValue(record.challanNo)}</span>
          <span><strong>Date:</strong> {formatDate(record.dateOfDelivery)}</span>
        </div>

        {/* Consignor & Consignee Grid */}
        <section className={styles.partyGrid}>
          <div className={styles.infoBlock}>
            <h2>Consignor:</h2>
            <p className={styles.partyName}><strong>H-BUS EQUIPMENT MANUFACTURING COMPANY</strong></p>
            <p>Industrial Growth Centre, Matia, (Mornai),<br />Goalpara, Assam, 783101</p>
            <p><strong>GSTN:</strong> 18AAKFH9190C1Z5</p>
          </div>
          <div className={styles.infoBlock}>
            <h2>Consignee:</h2>
            <p className={styles.partyName}><strong>{displayValue(record.partyName)}</strong></p>
            <p>{consigneeAddress}</p>
            <p><strong>GSTN:</strong> {displayValue(consigneeGstn)}</p>
          </div>
        </section>

        <p className={styles.instructionNote}>
          <em>Please receive the following materials in good order and condition and return the original &amp; duplicate copy duly signed.</em>
        </p>

        {/* Main Items Table */}
        <table className={styles.detailsTable}>
          <thead>
            <tr>
              <th style={{ width: '8%' }}>SL No</th>
              <th>Material&apos;s Description</th>
              <th style={{ width: '18%' }}>HSN Code</th>
              <th style={{ width: '15%' }}>Quantity</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className={styles.center}>1</td>
              <td>
                <div className={styles.mainDesc}>{itemName}</div>
                {record.DTRSerialNo && (
                  <div className={styles.serialNo}><em>SL No: {record.DTRSerialNo}</em></div>
                )}
                
                {/* Accessories Sublist */}
                {record.accessories && record.accessories.length > 0 && (
                  <div className={styles.accessoriesSection}>
                    <p className={styles.accTitle}>Accessories like:</p>
                    <ul className={styles.accList}>
                      {record.accessories.map((acc, idx) => {
                        const accItem = typeof acc.item === 'object' && acc.item !== null ? acc.item : undefined;
                        const accName = accItem?.name || 'Accessory Item';
                        return (
                          <li key={idx}>
                            <span className={styles.accBullet}>•</span>
                            <span className={styles.accName}>{accName}</span>
                            <span className={styles.accQty}>{displayValue(acc.quantity)} Nos.</span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </td>
              <td className={styles.center}>{displayValue(itemHsn)}</td>
              <td className={styles.center}>{displayValue(record.quantity)} Nos.</td>
            </tr>
          </tbody>
        </table>

        {/* Vehicle Information */}
        {record.vehicleDetails && (
          <div className={styles.vehicleBlock}>
            <p className={styles.vehicleTitle}>Motor Vehicle No</p>
            <p className={styles.vehicleNumber}><strong>{record.vehicleDetails}</strong></p>
          </div>
        )}

        {/* Signatures */}
        <section className={styles.receipt}>
          <div className={styles.signatureGrid}>
            <div><span>Receiver&apos;s signature</span></div>
            <div><span>Authorized signatory</span></div>
          </div>
        </section>
      </article>
    </main>
  );
}