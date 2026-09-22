import { Link } from 'react-router-dom'
import { SplitText } from '@/components/ui/SplitText'
import { useUi } from '@/content/ContentProvider'

export default function NotFound() {
  const ui = useUi()

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-void px-6 text-center">
      <p className="label mb-8 text-bloom">{ui.notFound.code}</p>
      <h1 className="tracked text-[clamp(1.6rem,5vw,3.5rem)] text-chalk">
        <SplitText text={ui.notFound.heading} />
      </h1>
      <p className="mt-6 max-w-md text-sm font-light text-mist">
        {ui.notFound.body}
      </p>
      <Link
        to="/"
        className="mt-12 border border-edge px-9 py-3.5 text-[0.62rem] tracking-[0.34em] text-chalk uppercase transition-all duration-500 hover:border-bloom hover:bg-bloom hover:text-void"
      >
        {ui.notFound.cta}
      </Link>
    </div>
  )
}
