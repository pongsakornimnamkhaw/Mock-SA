import { useState } from 'react'
import { Route, Routes } from 'react-router-dom'
import ConsertReportPage from './ConsertReportPage'

// B6728786 - Frontend (Ticket Booking)
import LoginPage from './pages/Login_page/Login'
import ForgotPasswordPage from './pages/Login_page/ForgotPassword'
import RegisterPage from './pages/Customer/Register'
import HomePage from './pages/Customer/Home'
import EventsPage from './pages/Customer/Events'
import IntroPage from './pages/Customer/intro'
import EventDetailPage from './pages/Customer/EventDetail'
import ZoneSelectionPage from './pages/Customer/ZoneSelection'
import SeatSelectionPage from './pages/Customer/SeatSelection'

// B6707651 - Frontend (Concert Management)
import Layout from './components/layout/Layout'
import DashboardPage from './pages/Employee/ConcertDashBoard'
import AddConcertPage from './pages/Employee/AddConcert'
import EditConcertPage from './pages/Employee/EditConcert'
import ResponsibilityPage from './pages/Employee/Responsibility'
import ConcertStatusPage from './pages/Employee/ConcertStatus'
import DocumentsPage from './pages/Employee/AddDocument'
import EditHistoryPage from './pages/Employee/ConcertEditHistory'
import SearchConcertPage from './features/venueSeats/VenueSeatsModule'
import ArtistDashboardPage from './pages/Employee/ArtistDashboard'
import ArtistInfoPage from './pages/Employee/ArtistInfo'
import InvitationPage from './pages/Employee/ArtistInvitation'
import PerformanceSchedulePage from './pages/Employee/PerfomanceSchedule'
import EditPerformancePage from './pages/Employee/EditPerfomance'
import PerformanceDetailPage from './pages/Employee/PerfomanceDetail'
import ArtistRequirementsPage from './pages/Employee/ArtistRequirement'
import ArtistEditHistoryPage from './pages/Employee/ArtistEditHistory'

import VenueSeatsViewPage from './pages/Customer/VenueSeatsView'

import RegistrationModule from './features/registration/RegistrationModule'

// B6717537 - Frontend (Promotions & Employees)
import PromotionLayout from './components/layout/PromotionLayout'
import PromotionListPage from './pages/Employee/promotions/list/PromotionListPage'
import PromotionDetailPage from './pages/Employee/promotions/detail/PromotionDetailPage'
import PromotionFormPage from './pages/Employee/promotions/form/PromotionFormPage'
import PromotionApprovalPage from './pages/Employee/promotions/approval/PromotionApprovalPage'
import UsageHistoryPage from './pages/Employee/history/UsageHistoryPage'
import EmployeeListPage from './pages/Employee/employees/EmployeeListPage'
import EmployeeFormPage from './pages/Employee/employees/EmployeeFormPage'
import type { EditHistoryEntry } from './types/promotion'

// B6733377 - External Contact
import ExternalContactLayout from './components/_frontend/ExternalContactLayout'
import { ContactHQ } from './pages/Customer/ContactHQ'
import { SponsorForm } from './pages/Customer/SponsorForm'
import { PlanningForm } from './pages/Customer/PlanningForm'
import { TicketingSupport } from './pages/Customer/TicketingSupport'
import { GeneralInquiryForm } from './pages/Customer/GeneralInquiryForm'

function App() {
  const [editHistory, setEditHistory] = useState<EditHistoryEntry[]>([])

  const handleAddHistory = (entry: EditHistoryEntry) =>
    setEditHistory((prev) => [entry, ...prev].slice(0, 50))

  return (
    <Routes>
      {/* B6728786 - Ticket Booking Routes */}
      <Route path="/" element={<IntroPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/home" element={<HomePage />} />
      <Route path="/events" element={<EventsPage />} />
      <Route path="/event-detail" element={<EventDetailPage />} />
      <Route path="/event/:id" element={<EventDetailPage />} />
      <Route path="/event/:id/zones" element={<ZoneSelectionPage />} />
      <Route path="/event/:id/seats/:zone" element={<SeatSelectionPage />} />

      {/* B6707651 - Concert Management Routes */}
      <Route path="/dashboard" element={<Layout title="ข้อมูลงานคอนเสิร์ตทั้งหมด"><DashboardPage /></Layout>} />
      <Route path="/add-concert" element={<Layout title="ข้อมูลงานคอนเสิร์ต"><AddConcertPage /></Layout>} />
      <Route path="/edit-concert" element={<Layout title="ข้อมูลงานคอนเสิร์ต"><EditConcertPage /></Layout>} />
      <Route path="/responsibility" element={<Layout title="ข้อมูลงานคอนเสิร์ต"><ResponsibilityPage /></Layout>} />
      <Route path="/concert-status" element={<Layout title="ข้อมูลงานคอนเสิร์ต"><ConcertStatusPage /></Layout>} />
      <Route path="/documents" element={<Layout title="ข้อมูลงานคอนเสิร์ต"><DocumentsPage /></Layout>} />
      <Route path="/edit-history" element={<Layout title="ข้อมูลงานคอนเสิร์ต"><EditHistoryPage /></Layout>} />
      <Route path="/search-concert" element={<Layout title="วางแผนจำหน่ายบัตร"><SearchConcertPage /></Layout>} />
      <Route path="/artist-dashboard" element={<Layout title="ข้อมูลศิลปินและการแสดงทั้งหมด"><ArtistDashboardPage /></Layout>} />
      <Route path="/artist-info" element={<Layout title="ข้อมูลศิลปินและตารางการแสดง"><ArtistInfoPage /></Layout>} />
      <Route path="/invitation" element={<Layout title="ข้อมูลศิลปินและตารางการแสดง"><InvitationPage /></Layout>} />
      <Route path="/performance-schedule" element={<Layout title="ข้อมูลศิลปินและตารางการแสดง"><PerformanceSchedulePage /></Layout>} />
      <Route path="/edit-performance" element={<Layout title="ข้อมูลศิลปินและตารางการแสดง"><EditPerformancePage /></Layout>} />
      <Route path="/performance-detail" element={<Layout title="ข้อมูลศิลปินและตารางการแสดง"><PerformanceDetailPage /></Layout>} />
      <Route path="/artist-requirements" element={<Layout title="ข้อมูลศิลปินและตารางการแสดง"><ArtistRequirementsPage /></Layout>} />
      <Route path="/artist-edit-history" element={<Layout title="ข้อมูลศิลปินและตารางการแสดง"><ArtistEditHistoryPage /></Layout>} />

      {/* B6708856 - seats & registration */}
      <Route path="/venues-seats/*" element={<Layout title="ห้องสถานที่และที่นั่ง"><VenueSeatsViewPage /></Layout>} />
      <Route path="/event-registration" element={<Layout title="ลงทะเบียนเข้างาน"><RegistrationModule /></Layout>} />

      {/* B6717537 - Promotion & Employee Routes */}
      <Route path="/promotions" element={<PromotionLayout><PromotionListPage editHistory={editHistory} onAddHistory={handleAddHistory} /></PromotionLayout>} />
      <Route path="/promotions/new" element={<PromotionLayout><PromotionFormPage /></PromotionLayout>} />
      <Route path="/promotions/:id" element={<PromotionLayout><PromotionDetailPage /></PromotionLayout>} />
      <Route path="/promotions/:id/edit" element={<PromotionLayout><PromotionFormPage /></PromotionLayout>} />
      <Route path="/approvals" element={<PromotionLayout><PromotionApprovalPage /></PromotionLayout>} />
      <Route path="/history" element={<PromotionLayout><UsageHistoryPage /></PromotionLayout>} />
      <Route path="/employees" element={<PromotionLayout><EmployeeListPage /></PromotionLayout>} />
      <Route path="/employees/new" element={<PromotionLayout><EmployeeFormPage /></PromotionLayout>} />
      <Route path="/employees/:id/edit" element={<PromotionLayout><EmployeeFormPage /></PromotionLayout>} />

      {/* B6733377 - Concert Report System */}
      <Route path="/report/*" element={<PromotionLayout><ConsertReportPage /></PromotionLayout>} />

      {/* B6733377 - External Contact */}
      <Route path="/contact" element={<ExternalContactLayout />}>
        <Route index element={<ContactHQ />} />
        <Route path="sponsor" element={<SponsorForm subTab="request" />} />
        <Route path="sponsor/status" element={<SponsorForm subTab="status" />} />
        <Route path="planning" element={<PlanningForm subTab="details" />} />
        <Route path="planning/status" element={<PlanningForm subTab="status" />} />
        <Route path="ticketing" element={<TicketingSupport subTab="request" />} />
        <Route path="ticketing/summary" element={<TicketingSupport subTab="summary" />} />
        <Route path="general" element={<GeneralInquiryForm />} />
      </Route>
    </Routes>
  )
}

export default App
