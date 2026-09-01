import {useParams} from 'react-router-dom';
const POFormat = () => {
  const { id } = useParams();

  return (
    <div>
        <h2>Purchase Order Format</h2>
        <p>This is a sample format for a Purchase Order (PO). You can customize it according to your business needs.</p>
        {id && <p>PO ID: {id}</p>}
    </div>
  );
};

export default POFormat;