import {BrowserRouter as Router, Routes, Route} from 'react-router-dom';
import { Toaster } from 'sonner';
import * as pages from "./pages";

function App() {
  return (
    <>
      <Toaster />
      <Router>
        <Routes>
          <Route path="/" element={<pages.Home />} />
          <Route path="/register" element={<pages.Register />} />
          <Route path="/users" element={<pages.Users />} />
          <Route path="/purchase" element={<pages.Purchase />} />
          <Route path="/purchase/new" element={<pages.PurchaseNew />} />
          <Route path="/location" element={<pages.Location />} />
          <Route path="/PO/:id" element={<pages.POFormat />} />
        </Routes>
      </Router>
    </>
  );
}

export default App;
