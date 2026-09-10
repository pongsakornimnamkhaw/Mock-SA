import { useState } from 'react'
import { Route, Routes } from 'react-router-dom'
import ConsertReportPage from './ConsertReportPage'

// B6728786 - Frontend (Ticket Booking & Auth Guards)
import LoginPage from './pages/Login_page/Login'
import ForgotPasswordPage from './pages/Login_page/ForgotPassword'
import ResetPasswordPage from './pages/Login_page/ResetPassword'
import RegisterPage from './pages/Customer/Register'
import EmployeeLoginPage from './pages/Employee/Login'
import CustomerRouteGuard from './components/auth/CustomerRouteGuard'
import EmployeeRouteGuard from './components/auth/EmployeeRouteGuard'
import HomePage from './pages/Customer/Home'
import EventsPage from './pages/Customer/Events'
import IntroPage from './pages/Customer/intro'
import EventDetailPage from './pages/Customer/EventDetail'
import ZoneSelectionPage from './pages/Customer/ZoneSelection'
import SeatSelectionPage from './pages/Customer/SeatSelection'
import CustomerAccountPage from './pages/Customer/Account'
import CustomerPromotionsPage from './pages/Customer/Promotions'
import CustomerPromotionDetailPage from './pages/Customer/PromotionDetail'
import SalesBookingManagementPage from './pages/Employee/SalesBookingManagement'

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
import EmployeeAccountPage from './pages/Employee/Account'
import EmployeePasswordRecoveryPage from './pages/Employee/PasswordRecovery'
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
      <Route path="/employee/login" element={<EmployeeLoginPage />} />
      <Route path="/staff/login" element={<EmployeeLoginPage />} />
      <Route path="/employee/forgot-password" element={<EmployeePasswordRecoveryPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/home" element={<HomePage />} />
      <Route path="/events" element={<EventsPage />} />
      <Route path="/offers" element={<CustomerPromotionsPage />} />
      <Route path="/offers/:id" element={<CustomerPromotionDetailPage />} />
      <Route path="/event-detail" element={<EventDetailPage />} />
      <Route path="/event/:id" element={<EventDetailPage />} />
      <Route path="/event/:id/zones" element={<ZoneSelectionPage />} />

      {/* Customer Protected Activities (ต้อง Login ก่อนทำรายการ) */}
      <Route path="/event/:id/seats/:zone" element={<CustomerRouteGuard><SeatSelectionPage /></CustomerRouteGuard>} />
      <Route path="/my-tickets" element={<CustomerRouteGuard><CustomerAccountPage mode="tickets" /></CustomerRouteGuard>} />
      <Route path="/purchase-history" element={<CustomerRouteGuard><CustomerAccountPage mode="history" /></CustomerRouteGuard>} />
      <Route path="/profile/edit" element={<CustomerRouteGuard><CustomerAccountPage mode="profile" /></CustomerRouteGuard>} />
      <Route path="/change-password" element={<CustomerRouteGuard><CustomerAccountPage mode="password" /></CustomerRouteGuard>} />

      {/* Sales Officer - Booking & Payment Verification (final document SA.docx: U4, UP2, UP3, UP5) */}
      <Route path="/sales/bookings" element={<EmployeeRouteGuard><Layout title="จัดการการจองและตรวจสอบการชำระเงิน"><SalesBookingManagementPage /></Layout></EmployeeRouteGuard>} />
      <Route path="/sales-bookings" element={<EmployeeRouteGuard><Layout title="จัดการการจองและตรวจสอบการชำระเงิน"><SalesBookingManagementPage /></Layout></EmployeeRouteGuard>} />
      <Route path="/payment-verification" element={<EmployeeRouteGuard><Layout title="จัดการการจองและตรวจสอบการชำระเงิน"><SalesBookingManagementPage /></Layout></EmployeeRouteGuard>} />

      {/* B6707651 - Concert Management Routes */}
      <Route path="/dashboard" element={<EmployeeRouteGuard><Layout title="ข้อมูลงานคอนเสิร์ตทั้งหมด"><DashboardPage /></Layout></EmployeeRouteGuard>} />
      <Route path="/add-concert" element={<EmployeeRouteGuard><Layout title="ข้อมูลงานคอนเสิร์ต"><AddConcertPage /></Layout></EmployeeRouteGuard>} />
      <Route path="/edit-concert" element={<EmployeeRouteGuard><Layout title="ข้อมูลงานคอนเสิร์ต"><EditConcertPage /></Layout></EmployeeRouteGuard>} />
      <Route path="/responsibility" element={<EmployeeRouteGuard><Layout title="ข้อมูลงานคอนเสิร์ต"><ResponsibilityPage /></Layout></EmployeeRouteGuard>} />
      <Route path="/concert-status" element={<EmployeeRouteGuard><Layout title="ข้อมูลงานคอนเสิร์ต"><ConcertStatusPage /></Layout></EmployeeRouteGuard>} />
      <Route path="/documents" element={<EmployeeRouteGuard><Layout title="ข้อมูลงานคอนเสิร์ต"><DocumentsPage /></Layout></EmployeeRouteGuard>} />
      <Route path="/edit-history" element={<EmployeeRouteGuard><Layout title="ข้อมูลงานคอนเสิร์ต"><EditHistoryPage /></Layout></EmployeeRouteGuard>} />
      <Route path="/search-concert" element={<EmployeeRouteGuard><Layout title="วางแผนหารจำหน่ายบัตร"><SearchConcertPage /></Layout></EmployeeRouteGuard>} />
      <Route path="/artist-dashboard" element={<EmployeeRouteGuard><Layout title="ข้อมูลศิลปินและการแสดงทั้งหมด"><ArtistDashboardPage /></Layout></EmployeeRouteGuard>} />
      <Route path="/artist-info" element={<EmployeeRouteGuard><Layout title="ข้อมูลศิลปินและตารางการแสดง"><ArtistInfoPage /></Layout></EmployeeRouteGuard>} />
      <Route path="/invitation" element={<EmployeeRouteGuard><Layout title="ข้อมูลศิลปินและตารางการแสดง"><InvitationPage /></Layout></EmployeeRouteGuard>} />
      <Route path="/performance-schedule" element={<EmployeeRouteGuard><Layout title="ข้อมูลศิลปินและตารางการแสดง"><PerformanceSchedulePage /></Layout></EmployeeRouteGuard>} />
      <Route path="/edit-performance" element={<EmployeeRouteGuard><Layout title="ข้อมูลศิลปินและตารางการแสดง"><EditPerformancePage /></Layout></EmployeeRouteGuard>} />
      <Route path="/performance-detail" element={<EmployeeRouteGuard><Layout title="ข้อมูลศิลปินและตารางการแสดง"><PerformanceDetailPage /></Layout></EmployeeRouteGuard>} />
      <Route path="/artist-requirements" element={<EmployeeRouteGuard><Layout title="ข้อมูลศิลปินและตารางการแสดง"><ArtistRequirementsPage /></Layout></EmployeeRouteGuard>} />
      <Route path="/artist-edit-history" element={<EmployeeRouteGuard><Layout title="ข้อมูลศิลปินและตารางการแสดง"><ArtistEditHistoryPage /></Layout></EmployeeRouteGuard>} />

      {/* B6708856 - seats & registration */}
      <Route path="/venues-seats/*" element={<EmployeeRouteGuard><Layout title="ห้องสถานที่และที่นั่ง"><VenueSeatsViewPage /></Layout></EmployeeRouteGuard>} />
      <Route path="/event-registration" element={<EmployeeRouteGuard><Layout title="ลงทะเบียนเข้างาน"><RegistrationModule /></Layout></EmployeeRouteGuard>} />

      {/* B6717537 - Promotion & Employee Routes */}
      <Route path="/promotions" element={<EmployeeRouteGuard><PromotionLayout><PromotionListPage editHistory={editHistory} onAddHistory={handleAddHistory} /></PromotionLayout></EmployeeRouteGuard>} />
      <Route path="/promotions/new" element={<EmployeeRouteGuard><PromotionLayout><PromotionFormPage /></PromotionLayout></EmployeeRouteGuard>} />
      <Route path="/promotions/:id" element={<EmployeeRouteGuard><PromotionLayout><PromotionDetailPage /></PromotionLayout></EmployeeRouteGuard>} />
      <Route path="/promotions/:id/edit" element={<EmployeeRouteGuard><PromotionLayout><PromotionFormPage /></PromotionLayout></EmployeeRouteGuard>} />
      <Route path="/approvals" element={<EmployeeRouteGuard><PromotionLayout><PromotionApprovalPage /></PromotionLayout></EmployeeRouteGuard>} />
      <Route path="/history" element={<EmployeeRouteGuard><PromotionLayout><UsageHistoryPage /></PromotionLayout></EmployeeRouteGuard>} />
      <Route path="/employees" element={<EmployeeRouteGuard><PromotionLayout><EmployeeListPage /></PromotionLayout></EmployeeRouteGuard>} />
      <Route path="/employees/new" element={<EmployeeRouteGuard><PromotionLayout><EmployeeFormPage /></PromotionLayout></EmployeeRouteGuard>} />
      <Route path="/employees/:id/edit" element={<EmployeeRouteGuard><PromotionLayout><EmployeeFormPage /></PromotionLayout></EmployeeRouteGuard>} />
      <Route path="/employee/account" element={<EmployeeRouteGuard><PromotionLayout><EmployeeAccountPage /></PromotionLayout></EmployeeRouteGuard>} />

      {/* B6733377 - Concert Report System */}
      <Route path="/report/*" element={<EmployeeRouteGuard><PromotionLayout><ConsertReportPage /></PromotionLayout></EmployeeRouteGuard>} />

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
