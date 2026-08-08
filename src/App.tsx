import {BrowserRouter as Router, Routes, Route} from 'react-router-dom';
import * as pages from "./pages";

function App() {
  
  return (
    <>
      <Router>
        <Routes>
          <Route path="/" element={<pages.Home />} />
        </Routes>
      </Router>
    </>
  )
}

export default App
