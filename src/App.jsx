import { Routes, Route } from 'react-router-dom'
import StudentApp from './StudentApp'
import AdminApp from './AdminApp'
import './App.css'

export default function App() {
  return (
    <Routes>
      <Route path="/admin/*" element={<AdminApp />} />
      <Route path="/*"       element={<StudentApp />} />
    </Routes>
  )
}
