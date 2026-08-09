import {BrowserRouter as Router, Routes, Route} from 'react-router-dom';
import * as pages from "./pages";

function App() {
  return (
    <>
      <Router>
        <Routes>
          <Route path="/" element={<pages.Home />} />
          <Route path="/register" element={<pages.Register />} />
        </Routes>
      </Router>
    </>
  );
}

export default App;
