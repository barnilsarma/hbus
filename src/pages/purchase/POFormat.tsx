import {useParams} from 'react-router-dom';
import {useEffect, useState} from 'react';
import styles from './POFormat.module.scss';
import axios from 'axios';
const POFormat = () => {
  const { id } = useParams();
  const [poData, setPoData] = useState<any>(null);
  useEffect(() => {
    const fetchPOData = async () => {
      try {
        const response = await axios.get(`${import.meta.env.VITE_APP_API}/api/purchases/${id}`);
        setPoData(response.data);
        console.log('Fetched PO data:', response.data);
      } catch (error) {
        console.error('Error fetching PO data:', error);
      }
    };

    fetchPOData();
  }, [id]);

  return (
    <div className={styles.container}>
        <h2 className={styles.title}>Purchase Order Format</h2>
        <div className={styles.pobody}>
          <h1 className={styles.title}>PURCHASE ORDER</h1>
          <div className={styles.headingrow}>
            <div className={styles.logoHolder}>
              <img src='/assets/hbuslogo.png' alt="HBus Logo" className={styles.logo} />
            </div>
            <div className={styles.companyTaglineCont}>
              <h1 className={styles.companyTagline}><span>E</span>QUIPMENT <span>M</span>ANUFACTURING <span>C</span>OMPANY</h1>
            </div>
          </div>
          <div className={styles.secondHeading}>
            <div className={styles.leftSection}>
              <p>PO Number: {poData?.PONumber || '-'}</p>
            </div>
            <div className={styles.rightSection}>
              <p>Date: {poData?.invoicedate ? new Date(poData.invoicedate).toLocaleDateString() : '-'}</p>
            </div>
          </div>
          <div className={styles.thirdHeading}>
            <div className={styles.leftSection}>
              <div>
                To,<br />
                <p>{poData?.supplier || '-'}</p>
              </div>
              <div>
                <p>GSTN:</p>
                {
                  poData?.gstn.split("").map((line: string, index: number) => (
                    <span key={index} style={{padding: '5px',border:"1px solid #ffffff",color:'#ffffff' }}>{line}</span>
                  ))
                }
              </div>
              <div>
                <p>State:{poData?.supplierState || '-'}</p>
                <p>State Code: {poData?.supplierStateCode || '-'}</p>
              </div>
            </div>
            <div className={styles.rightSection}>
              <p>{poData?.location?.address || '-'}</p>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Sl No.</th>
                <th>Item Description</th>
                <th>GST</th>
                <th>Unit</th>
                <th>Rate</th>
                <th>Qty</th>
                <th>Total Amount</th>
              </tr>
            </thead>
            <tbody>
              
                <tr>
                  <td>1.</td>
                  <td>{poData?.item || '-'}</td>
                  <td>{poData?.gst || '-'}</td>
                  <td>{poData?.unit || '-'}</td>
                  <td>{poData?.rate || '-'}</td>
                  <td>{poData?.qty || '-'}</td>
                  <td>{poData?.amount || '-'}</td>
                </tr>
      
            </tbody>
          </table>
        </div>
    </div>
  );
};

export default POFormat;