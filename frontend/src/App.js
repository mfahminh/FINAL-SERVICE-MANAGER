import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider } from "@/context/AuthContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { BrandingProvider } from "@/context/BrandingContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Layout from "@/components/Layout";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Customers from "@/pages/Customers";
import Services from "@/pages/Services";
import NewService from "@/pages/NewService";
import ServiceDetail from "@/pages/ServiceDetail";
import Spareparts from "@/pages/Spareparts";
import Suppliers from "@/pages/Suppliers";
import Purchases from "@/pages/Purchases";
import Payments from "@/pages/Payments";
import Reports from "@/pages/Reports";
import AuditLogs from "@/pages/AuditLogs";
import Settings from "@/pages/Settings";
import Users from "@/pages/Users";
import PublicTrack from "@/pages/PublicTrack";
import Technicians from "@/pages/Technicians";
import MyJobs from "@/pages/MyJobs";
import FinancialReports from "@/pages/FinancialReports";
import UserApprovals from "@/pages/UserApprovals";
import QCQueue from "@/pages/QCQueue";
import DirectSale from "@/pages/DirectSale";

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrandingProvider>
        <BrowserRouter>
          <Toaster position="bottom-right" richColors />
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/track" element={<PublicTrack />} />
            <Route path="/track/:sn" element={<PublicTrack />} />
            <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route index element={<Dashboard />} />
              <Route path="services" element={<Services />} />
              <Route path="services/new" element={<NewService />} />
              <Route path="services/:id" element={<ServiceDetail />} />
              <Route path="customers" element={<Customers />} />
              <Route path="my-jobs" element={<ProtectedRoute roles={["teknisi", "owner", "admin"]}><MyJobs /></ProtectedRoute>} />
              <Route path="qc" element={<ProtectedRoute roles={["owner", "admin"]}><QCQueue /></ProtectedRoute>} />
              <Route path="direct-sale" element={<ProtectedRoute roles={["owner", "admin", "kasir"]}><DirectSale /></ProtectedRoute>} />
              <Route path="technicians" element={<ProtectedRoute roles={["owner", "admin"]}><Technicians /></ProtectedRoute>} />
              <Route path="financial" element={<ProtectedRoute roles={["owner", "admin"]}><FinancialReports /></ProtectedRoute>} />
              <Route path="approvals" element={<ProtectedRoute roles={["owner"]}><UserApprovals /></ProtectedRoute>} />
              <Route path="spareparts" element={<Spareparts />} />
              <Route path="suppliers" element={<ProtectedRoute roles={["owner", "admin"]}><Suppliers /></ProtectedRoute>} />
              <Route path="purchases" element={<ProtectedRoute roles={["owner", "admin"]}><Purchases /></ProtectedRoute>} />
              <Route path="payments" element={<Payments />} />
              <Route path="reports" element={<ProtectedRoute roles={["owner", "admin"]}><Reports /></ProtectedRoute>} />
              <Route path="users" element={<ProtectedRoute roles={["owner", "admin"]}><Users /></ProtectedRoute>} />
              <Route path="audit" element={<ProtectedRoute roles={["owner", "admin"]}><AuditLogs /></ProtectedRoute>} />
              <Route path="settings" element={<ProtectedRoute roles={["owner", "admin"]}><Settings /></ProtectedRoute>} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
        </BrandingProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
