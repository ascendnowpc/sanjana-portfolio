import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Nav } from '@/components/layout/Nav'
import { Footer } from '@/components/layout/Footer'
import { Ambience } from '@/components/layout/Ambience'
import { ScrollToTop } from '@/components/layout/ScrollToTop'
import { TransitionProvider } from '@/components/layout/TransitionProvider'
import { Preloader } from '@/components/layout/Preloader'
import { ContentProvider, useUi } from '@/content/ContentProvider'
import { EditProvider, useEdit } from '@/edit/EditProvider'

import Home from '@/routes/Home'

// The index is the entry point and ships in the main chunk; everything else
// is split, so the first paint only pays for the gallery. The panel is split
// hardest of all — a visitor who never opens it never downloads it.
const Work = lazy(() => import('@/routes/Work'))
const WorkDetail = lazy(() => import('@/routes/WorkDetail'))
const About = lazy(() => import('@/routes/About'))
const Contact = lazy(() => import('@/routes/Contact'))
const Admin = lazy(() => import('@/routes/Admin'))
const NotFound = lazy(() => import('@/routes/NotFound'))

/**
 * The editing bar, the drawer and everything they pull in.
 *
 * Split off hardest of all and mounted only for somebody who has signed in, so a
 * visitor downloads none of it — not the bar, not the panel's form sections
 * behind the drawer, and not the video tools behind those.
 */
const EditLayer = lazy(() => import('@/components/edit/EditLayer'))

/**
 * The tab, the crawler's summary, and the colour a phone paints its chrome.
 *
 * These three live in index.html as static tags, which is right for a first
 * paint and wrong for anything editable — so the markup keeps its defaults
 * (they are what a crawler that runs no JavaScript will read) and this writes
 * over them once the app is up. Editing the title in the panel therefore
 * changes the tab immediately, and changes the served HTML only when somebody
 * carries the value back into index.html.
 */
function DocumentHead() {
  const ui = useUi()

  useEffect(() => {
    document.title = ui.meta.title

    const set = (selector: string, content: string) => {
      const tag = document.head.querySelector<HTMLMetaElement>(selector)
      if (tag) tag.content = content
    }
    set('meta[name="description"]', ui.meta.description)
    set('meta[name="theme-color"]', ui.meta.themeColor)
  }, [ui.meta.title, ui.meta.description, ui.meta.themeColor])

  return null
}

/** The editor's chrome, for the editor only. */
function EditChrome() {
  const { signedIn } = useEdit()
  if (!signedIn) return null
  return (
    <Suspense fallback={null}>
      <EditLayer />
    </Suspense>
  )
}

function Shell() {
  const location = useLocation()
  const isHome = location.pathname === '/'
  // The panel brings its own chrome and is not part of the site's reading
  // order — a nav bar and a footer over it would put two "Contact" links on a
  // screen that is for editing the Contact page.
  const isAdmin = location.pathname.startsWith('/admin')

  return (
    <>
      <ScrollToTop />
      {!isAdmin && <Nav />}

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
            <Route path="/admin" element={<Admin />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </motion.main>

      {!isHome && !isAdmin && <Footer />}

      {/* Over every page except the panel.
          The bar exists to answer "what is the state of what I am looking at?"
          for a page that is only showing content. The panel answers it about
          its own form, in its own bar at the foot of the screen — and two bars
          in the same corner, each with a Save and a Publish on it, is a
          question rather than an answer. */}
      {!isAdmin && <EditChrome />}
    </>
  )
}

export default function App() {
  return (
    <ContentProvider>
      <BrowserRouter>
        {/* Inside the router, because the editing bar links into the panel;
            inside the content provider, because the session reads the password
            it checks out of the content it edits. */}
        <EditProvider>
          <DocumentHead />
          <TransitionProvider>
            <Preloader />
            <Ambience />
            <Shell />
          </TransitionProvider>
        </EditProvider>
      </BrowserRouter>
    </ContentProvider>
  )
}
