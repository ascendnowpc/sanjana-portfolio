import { Link } from 'react-router-dom'
import { SplitText } from '@/components/ui/SplitText'

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-void px-6 text-center">
      <p className="label mb-8 text-bloom">404</p>
      <h1 className="tracked text-[clamp(1.6rem,5vw,3.5rem)] text-chalk">
        <SplitText text="Nothing on this stage" />
      </h1>
      <p className="mt-6 max-w-md text-sm font-light text-mist">
        That page has struck its set. Try the index instead.
      </p>
      <Link
        to="/"
        className="mt-12 border border-edge px-9 py-3.5 text-[0.62rem] tracking-[0.34em] text-chalk uppercase transition-all duration-500 hover:border-bloom hover:bg-bloom hover:text-void"
      >
        Back to the index
      </Link>
    </div>
  )
}
