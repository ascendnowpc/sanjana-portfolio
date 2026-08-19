import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Nav } from '@/components/layout/Nav'
import { Footer } from '@/components/layout/Footer'
import { Cursor } from '@/components/layout/Cursor'
import { Ambience } from '@/components/layout/Ambience'
import { ScrollToTop } from '@/components/layout/ScrollToTop'
import { TransitionProvider } from '@/components/layout/TransitionProvider'
import { Preloader } from '@/components/layout/Preloader'

import Home from '@/routes/Home'

// The index is the entry point and ships in the main chunk; everything else
// is split, so the first paint only pays for the gallery.
const Work = lazy(() => import('@/routes/Work'))
const WorkDetail = lazy(() => import('@/routes/WorkDetail'))
const About = lazy(() => import('@/routes/About'))
const Contact = lazy(() => import('@/routes/Contact'))
const NotFound = lazy(() => import('@/routes/NotFound'))

function Shell() {
  const location = useLocation()
  const isHome = location.pathname === '/'

  return (
    <>
      <ScrollToTop />
      <Nav />

      {/* Keyed on pathname so each page remounts and replays its entrance. */}
      <motion.main
        key={location.pathname}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        <Suspense fallback={<div className="min-h-screen bg-void" />}>
          <Routes location={location}>
            <Route path="/" element={<Home />} />
            <Route path="/work" element={<Work />} />
            <Route path="/work/:slug" element={<WorkDetail />} />
            <Route path="/about" element={<About />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </motion.main>

      {!isHome && <Footer />}
    </>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <TransitionProvider>
        <Preloader />
        <Ambience />
        <Cursor />
        <Shell />
      </TransitionProvider>
    </BrowserRouter>
  )
}
