import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { Form } from '@/components/ui/form';
import { ErrorBoundary } from '@/components/error-boundary';
import {
  getGetEventAvailabilityQueryKey,
  getListGuestRsvpsQueryKey,
  getListRsvpsQueryKey,
  useCreateRsvp,
  useDeleteRsvp,
  useGetEventAvailability,
  useListGuestRsvps,
  useListRsvps,
  useLoginOrganiser,
  useUpdateRsvp,
  type DishCategory,
  type EventAvailability,
  type GuestRsvp,
  type Rsvp,
  type RsvpInput,
} from '@workspace/api-client-react';
import { ArrowLeft, ArrowRight, Check, CircleAlert, Clock3, ExternalLink, Feather, Mail, MapPin, MapPinned, Pencil, RefreshCw, Save, Sparkles, Trash2, TrainFront, Users, UtensilsCrossed, X } from 'lucide-react';
import { Link, Route, Switch, Router as WouterRouter, useLocation } from 'wouter';
import { useForm } from 'react-hook-form';
import NotFound from '@/pages/not-found';

const queryClient = new QueryClient();

type FormValues = RsvpInput;

const defaultValues: FormValues = {
  name: '',
  contact: '',
  attending: true,
  guests: 0,
  categoryId: '',
  dishName: '',
  dishOrigin: '',
  dishMemory: '',
  guestDietary: [],
  guestAllergies: '',
  dishIngredients: '',
  dishDietary: [],
};

const locationAddress = '215A Anzac Parade, Kensington NSW 2033';
const mapEmbedUrl = `https://www.google.com/maps?q=${encodeURIComponent(locationAddress)}&output=embed`;

function directionsUrl(origin: string) {
  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(locationAddress)}&travelmode=transit`;
}

function rsvpToFormValues(rsvp: Rsvp): FormValues {
  return {
    name: rsvp.name,
    contact: rsvp.contact,
    attending: rsvp.attending,
    guests: 0,
    categoryId: rsvp.categoryId,
    dishName: rsvp.dishName,
    dishOrigin: rsvp.dishOrigin,
    dishMemory: rsvp.dishMemory,
    guestDietary: rsvp.guestDietary,
    guestAllergies: rsvp.guestAllergies,
    dishIngredients: rsvp.dishIngredients,
    dishDietary: rsvp.dishDietary,
  };
}

function formatEventDate(value?: string) {
  if (!value) return 'Date to be announced';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(parsed);
}

function Shell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return (
    <div className="paper-grain min-h-[100dvh] bg-background">
      <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8 lg:px-12">
        <Link href="/" data-testid="link-home" className="focus-ring flex items-center gap-3 text-foreground no-underline">
          <span className="grid h-10 w-10 rotate-[-7deg] place-items-center rounded-[48%_52%_45%_55%] bg-secondary text-primary-foreground shadow-sm">
            <Feather size={18} strokeWidth={1.6} />
          </span>
           <span><span className="block font-serif text-lg font-semibold tracking-[-.03em]">A taste of home</span><span className="font-mono text-[9px] uppercase tracking-[.16em] text-primary">Shay&apos;s Friendsgiving Dinner</span></span>
        </Link>
        <nav className="flex items-center gap-2 text-sm font-medium">
          <Link href="/" data-testid="link-rsvp" className={`focus-ring rounded-full px-3 py-2 transition-colors ${location === '/' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}>RSVP</Link>
           <Link href="/guest" data-testid="link-guest" className={`focus-ring rounded-full px-3 py-2 transition-colors ${location === '/guest' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}>Guest</Link>
           <Link href="/organiser" data-testid="link-organiser" className={`focus-ring rounded-full px-3 py-2 transition-colors ${location === '/organiser' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}>Organiser</Link>
        </nav>
      </header>
      {children}
      <footer className="mx-auto flex max-w-7xl flex-col gap-2 px-5 pb-8 pt-16 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-12">
        <span className="font-serif text-base text-foreground">Made for the people who make this place feel like home.</span>
        <span className="font-mono text-[10px] uppercase tracking-[.18em]">Est. around one table</span>
      </footer>
    </div>
  );
}

function QueryError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-[1.5rem] border border-destructive/30 bg-card p-8 text-center shadow-sm" data-testid="state-error">
      <CircleAlert className="mx-auto mb-3 text-destructive" size={26} />
      <h2 className="font-serif text-2xl">The invitation got a little smudged.</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{message}</p>
      <button type="button" onClick={onRetry} data-testid="button-retry" className="focus-ring mt-5 inline-flex items-center gap-2 rounded-full bg-secondary px-5 py-2.5 text-sm font-semibold text-secondary-foreground transition-transform hover:-translate-y-0.5">
        <RefreshCw size={15} /> Try again
      </button>
    </div>
  );
}

function AvailabilitySkeleton() {
  return (
    <div className="space-y-3" aria-label="Loading event details" data-testid="state-loading">
      <div className="h-5 w-32 animate-pulse rounded-full bg-muted" />
      <div className="h-12 w-3/4 animate-pulse rounded-xl bg-muted" />
      <div className="h-4 w-1/2 animate-pulse rounded-full bg-muted" />
    </div>
  );
}

function EventNote({ event }: { event: EventAvailability }) {
  return (
    <aside className="relative overflow-hidden rounded-[2rem] bg-secondary p-7 text-primary-foreground shadow-md sm:p-9">
      <div className="absolute -right-10 -top-14 h-40 w-40 rounded-full border-[18px] border-primary/20" />
      <div className="absolute -bottom-20 -left-12 h-48 w-48 rounded-full border-[22px] border-accent/20" />
      <div className="relative">
        <div className="mb-10 flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-[.2em] text-primary-foreground/65">The details</span>
          <span className="rounded-full border border-primary-foreground/20 px-3 py-1 font-mono text-[10px] uppercase tracking-[.15em] text-primary-foreground/65">Save the date</span>
        </div>
        <p className="font-serif text-3xl leading-[1.05]">{event.eventName}</p>
        <div className="mt-9 space-y-4 text-sm text-primary-foreground/80">
          <div className="flex items-start gap-3"><Clock3 size={17} className="mt-0.5 shrink-0 text-accent" /><span>{formatEventDate(event.date)}<br />{event.time}</span></div>
          <div className="flex items-start gap-3"><MapPin size={17} className="mt-0.5 shrink-0 text-accent" /><span>{event.location}</span></div>
        </div>
        <div className="mt-10 border-t border-primary-foreground/15 pt-5">
          <p className="font-serif text-xl italic text-primary-foreground/90">Bring what you love to make.</p>
          <p className="mt-2 text-xs leading-relaxed text-primary-foreground/60">No perfect dishes. Just the ones with a little story in them.</p>
        </div>
      </div>
    </aside>
  );
}

function RsvpPage() {
  const eventQuery = useGetEventAvailability();
  const queryClientInstance = useQueryClient();
  const createRsvp = useCreateRsvp();
  const event = eventQuery.data;
  const [step, setStep] = useState(1);
  const [submitted, setSubmitted] = useState<Rsvp | null>(null);
  const form = useForm<FormValues>({ defaultValues, mode: 'onTouched' });
  const attending = form.watch('attending');
  const selectedCategory = form.watch('categoryId');
  const categories = useMemo(() => event?.categories ?? [], [event?.categories]);
  const availableCategories = useMemo(() => categories.filter((category) => category.remaining > 0), [categories]);

  const next = async () => {
    if (step === 1) {
      const valid = await form.trigger(['name', 'contact']);
      if (!valid) return;
      setStep(attending ? 2 : 4);
    } else if (step === 2) {
      const valid = await form.trigger(['categoryId', 'dishName']);
      if (!valid) return;
      setStep(3);
    } else {
      setStep((current) => Math.min(4, current + 1));
    }
    window.setTimeout(() => document.getElementById('rsvp-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 40);
  };

  const back = () => {
    if (step === 4 && !attending) setStep(1);
    else setStep((current) => Math.max(1, current - 1));
    window.setTimeout(() => document.getElementById('rsvp-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 40);
  };

  const submit = form.handleSubmit((values) => {
    if (step < 4) {
      void next();
      return;
    }
    const payload: RsvpInput = attending
      ? { ...values, guests: 0 }
      : { ...values, attending: false, guests: 0, categoryId: 'declined', dishName: '', dishOrigin: '', dishMemory: '', guestDietary: [], guestAllergies: '', dishIngredients: '', dishDietary: [] };
    createRsvp.mutate({ data: payload }, {
      onSuccess: (rsvp) => {
        setSubmitted(rsvp);
        void queryClientInstance.invalidateQueries({ queryKey: getGetEventAvailabilityQueryKey() });
        void queryClientInstance.invalidateQueries({ queryKey: getListRsvpsQueryKey() });
      },
    });
  });

  if (submitted) return <SuccessView event={event} rsvp={submitted} />;

  return (
    <Shell>
      <main>
        <section className="relative mx-auto grid max-w-7xl items-center gap-12 px-5 pb-16 pt-10 sm:px-8 lg:grid-cols-[1.12fr_.88fr] lg:gap-20 lg:px-12 lg:pb-28 lg:pt-16">
          <div className="animate-rise">
            <div className="mb-7 flex items-center gap-3 ornament font-mono text-[10px] uppercase">
              <span className="h-px w-10 bg-primary" /> An invitation to gather
            </div>
            <h1 className="max-w-3xl font-serif text-[clamp(3.5rem,8vw,7.7rem)] font-medium leading-[.87] tracking-[-.065em] text-secondary">
              Come as you are.<br /><span className="ink-line italic text-primary">Bring a story.</span>
            </h1>
            <p className="mt-8 max-w-xl text-lg leading-relaxed text-muted-foreground sm:text-xl">A meal shared is a small kind of magic. Tell us you’re coming, then choose the dish that feels most like you.</p>
            <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-3 text-xs font-semibold uppercase tracking-[.12em] text-secondary/70">
              <span className="flex items-center gap-2"><Sparkles size={15} className="text-primary" /> One table</span>
              <span className="flex items-center gap-2"><Users size={15} className="text-primary" /> Many stories</span>
            </div>
          </div>
          <div className="animate-float animate-rise delay-2"><div className="rotate-[2.5deg]"><EventAvailabilityCard event={event} isLoading={eventQuery.isLoading} isError={eventQuery.isError} onRetry={() => void eventQuery.refetch()} /></div></div>
        </section>

        <section id="rsvp-form" className="scroll-mt-4 border-t border-border/70 bg-card/45 px-5 py-14 sm:px-8 lg:px-12 lg:py-20">
          <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[.28fr_1fr] lg:gap-20">
            <div className="lg:sticky lg:top-8 lg:self-start">
              <p className="font-mono text-[10px] uppercase tracking-[.2em] text-primary">Your place at the table</p>
              <p className="mt-4 font-serif text-3xl leading-tight text-secondary">A few little things so we can make room.</p>
              <Progress step={step} attending={attending} />
            </div>
            <div className="max-w-2xl">
              <Form {...form}>
                <form onSubmit={submit} className="rounded-[2rem] border border-card-border bg-card p-6 shadow-sm sm:p-10">
                  {step === 1 && <StepWelcome form={form} attending={attending} />}
                  {step === 2 && <StepDish form={form} categories={availableCategories} selectedCategory={selectedCategory} />}
                  {step === 3 && <StepStory form={form} />}
                  {step === 4 && <StepReview form={form} event={event} categories={categories} attending={attending} onEdit={setStep} />}
                  {createRsvp.isError && <div className="mt-6 flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive" data-testid="status-submit-error"><CircleAlert size={18} className="mt-0.5 shrink-0" /><span>We couldn’t save that RSVP just yet. Check the email address and your connection, then try again.</span></div>}
                  <div className="mt-9 flex items-center justify-between gap-4 border-t border-border/70 pt-6">
                    {step > 1 ? <button type="button" onClick={back} data-testid="button-back" className="focus-ring inline-flex items-center gap-2 rounded-full px-2 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"><ArrowLeft size={16} /> Back</button> : <span />}
                    {step < 4 ? (
                      <button type="button" onClick={() => void next()} data-testid="button-next" className="focus-ring inline-flex items-center gap-3 rounded-full bg-primary px-6 py-3 text-sm font-bold text-primary-foreground shadow-[4px_4px_0_hsl(var(--secondary)/.18)] transition-transform hover:-translate-y-0.5 active:translate-y-0">
                        Continue <ArrowRight size={16} />
                      </button>
                    ) : (
                      <button type="submit" disabled={createRsvp.isPending} data-testid="button-submit-rsvp" className="focus-ring inline-flex items-center gap-3 rounded-full bg-primary px-6 py-3 text-sm font-bold text-primary-foreground shadow-[4px_4px_0_hsl(var(--secondary)/.18)] transition-transform hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-60">
                        {createRsvp.isPending ? 'Submitting your RSVP…' : 'Submit RSVP'} <Check size={16} />
                      </button>
                    )}
                  </div>
                </form>
              </Form>
            </div>
          </div>
        </section>
        <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:px-12 lg:py-24">
          <div className="grid gap-8 md:grid-cols-[.7fr_1.3fr] md:items-end">
            <p className="font-mono text-[10px] uppercase tracking-[.2em] text-primary">A gentle reminder</p>
            <p className="font-serif text-3xl leading-tight text-secondary sm:text-5xl">The best part isn’t what’s on the menu. It’s who pulled up a chair.</p>
          </div>
        </section>
      </main>
    </Shell>
  );
}

function EventAvailabilityCard({ event, isLoading, isError, onRetry }: { event?: EventAvailability; isLoading: boolean; isError: boolean; onRetry: () => void }) {
  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-card-border bg-card p-7 handmade-shadow sm:p-9">
      <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-accent/30 blur-[1px]" />
      <div className="relative">
        <div className="mb-12 flex items-center justify-between"><span className="font-mono text-[10px] uppercase tracking-[.2em] text-primary">You’re invited</span><span className="h-3 w-3 rounded-full bg-primary shadow-[0_0_0_5px_hsl(var(--primary)/.12)]" /></div>
        {isLoading ? <AvailabilitySkeleton /> : isError || !event ? <QueryError message="We couldn’t load the event details." onRetry={onRetry} /> : <><p className="font-serif text-4xl leading-[.98] text-secondary">{event.eventName}</p><div className="mt-7 space-y-3 text-sm text-muted-foreground"><p className="flex gap-3"><Clock3 size={17} className="shrink-0 text-primary" /> <span>{formatEventDate(event.date)}<br />{event.time}</span></p><p className="flex gap-3"><MapPin size={17} className="shrink-0 text-primary" /> <span>{event.location}</span></p></div><div className="mt-12 border-t border-border/70 pt-5"><p className="text-sm font-semibold text-foreground">Come hungry. Leave carrying a new memory.</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">Your dish category is held as you RSVP so the table stays beautifully balanced.</p></div></>}
      </div>
    </div>
  );
}

function Progress({ step, attending }: { step: number; attending: boolean }) {
  const labels = attending ? ['You', 'Your dish', 'The story', 'Review'] : ['You', 'Review'];
  return <div className="mt-10 hidden space-y-4 lg:block">{labels.map((label, index) => { const number = attending ? index + 1 : index === 0 ? 1 : 4; const active = number === step; const done = number < step; return <div key={label} className={`flex items-center gap-3 text-sm ${active ? 'font-bold text-secondary' : 'text-muted-foreground'}`}><span className={`grid h-7 w-7 place-items-center rounded-full border text-xs ${done ? 'border-primary bg-primary text-primary-foreground' : active ? 'border-primary text-primary' : 'border-border'}`}>{done ? <Check size={13} /> : number}</span>{label}</div>; })}</div>;
}

function FieldLabel({ children, hint }: { children: ReactNode; hint?: string }) {
  return <div className="mb-2 flex items-baseline justify-between gap-4"><label className="text-sm font-bold text-secondary">{children}</label>{hint && <span className="text-xs text-muted-foreground">{hint}</span>}</div>;
}

function StepWelcome({ form, attending }: { form: ReturnType<typeof useForm<FormValues>>; attending: boolean }) {
  return <div className="animate-rise"><StepHeading eyebrow="01 / Set the table" title="Will you be there?" intro="Start with the essentials. We’ll take it from there." /><div className="space-y-6">
    <div><FieldLabel>Your name</FieldLabel><input {...form.register('name', { required: 'Tell us your name' })} data-testid="input-name" placeholder="The name on the place card" className="input-keep" />{form.formState.errors.name && <p className="field-error">{form.formState.errors.name.message}</p>}</div>
    <div><FieldLabel hint="Required — your confirmation and calendar invite go here">Email address</FieldLabel><input type="email" autoComplete="email" {...form.register('contact', { required: 'Your email address is required', pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Enter a valid email address' } })} data-testid="input-email" placeholder="hello@example.com" className="input-keep" />{form.formState.errors.contact && <p className="field-error">{form.formState.errors.contact.message}</p>}</div>
    <div><FieldLabel>Are you joining us?</FieldLabel><div className="grid gap-3 sm:grid-cols-2"><label className={`choice-card ${attending ? 'choice-card-selected' : ''}`}><input type="radio" name="attending-choice" checked={attending} onChange={() => form.setValue('attending', true, { shouldDirty: true })} data-testid="radio-attending-yes" /><span><strong>Yes, I’ll be there</strong><small>Save me a place at the table</small></span></label><label className={`choice-card ${!attending ? 'choice-card-selected' : ''}`}><input type="radio" name="attending-choice" checked={!attending} onChange={() => form.setValue('attending', false, { shouldDirty: true })} data-testid="radio-attending-no" /><span><strong>Can’t make it</strong><small>I’ll be with you in spirit</small></span></label></div></div>
   </div></div>;
}

function StepHeading({ eyebrow, title, intro }: { eyebrow: string; title: string; intro: string }) {
  return <div className="mb-8"><p className="font-mono text-[10px] uppercase tracking-[.2em] text-primary">{eyebrow}</p><h2 className="mt-3 font-serif text-4xl leading-tight text-secondary sm:text-5xl">{title}</h2><p className="mt-3 text-muted-foreground">{intro}</p></div>;
}

function StepDish({ form, categories, selectedCategory }: { form: ReturnType<typeof useForm<FormValues>>; categories: DishCategory[]; selectedCategory: string }) {
  return <div className="animate-rise"><StepHeading eyebrow="02 / Bring a little love" title="What’s your dish?" intro="We’re balancing the table together. Pick a category with room left in it." /><input type="hidden" {...form.register('categoryId', { required: 'Choose a category so we can balance the table' })} />{categories.length === 0 ? <div className="rounded-2xl border border-border bg-muted/35 p-6 text-sm text-muted-foreground" data-testid="state-empty-categories">Every category is spoken for. Send your RSVP anyway and we’ll find a beautiful way to include you.</div> : <div className="grid gap-3">{categories.map((category) => <button type="button" key={category.id} onClick={() => form.setValue('categoryId', category.id, { shouldValidate: true, shouldDirty: true })} data-testid={`button-category-${category.id}`} className={`group rounded-2xl border p-5 text-left transition-all hover:-translate-y-0.5 ${selectedCategory === category.id ? 'border-primary bg-primary/7 shadow-[4px_4px_0_hsl(var(--primary)/.13)]' : 'border-border bg-background/35 hover:border-primary/50'}`}><div className="flex items-start justify-between gap-4"><div><span className="font-mono text-[10px] uppercase tracking-[.16em] text-primary">{category.shortName}</span><h3 className="mt-1 font-serif text-2xl text-secondary">{category.name}</h3><p className="mt-1 text-sm leading-relaxed text-muted-foreground">{category.description}</p></div><span className={`shrink-0 rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-[.08em] ${selectedCategory === category.id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>{category.remaining} left</span></div><div className="mt-4 h-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.min(100, (category.claimed / Math.max(category.target, 1)) * 100)}%` }} /></div></button>)}</div>}{form.formState.errors.categoryId && <p className="field-error">{form.formState.errors.categoryId.message}</p>}<div className="mt-7"><FieldLabel>Your dish’s name <span className="font-normal text-muted-foreground">(working title is fine)</span></FieldLabel><input {...form.register('dishName', { required: 'Give your dish a name' })} data-testid="input-dish-name" placeholder="The one everyone asks for" className="input-keep" />{form.formState.errors.dishName && <p className="field-error">{form.formState.errors.dishName.message}</p>}</div></div>;
}

function StepStory({ form }: { form: ReturnType<typeof useForm<FormValues>> }) {
  const guestNeeds = ['Everything', 'Vegetarian', 'Vegan', 'Halal', 'No beef', 'No pork', 'No seafood', 'Gluten-free', 'Other'];
  const dishLabels = ['Contains nuts', 'Contains soy', 'Contains lactose / dairy', 'Contains gluten', 'Vegetarian', 'Vegan', 'Halal', 'Kosher', 'No beef', 'No pork', 'No seafood'];
  return <div className="animate-rise"><StepHeading eyebrow="03 / The details that help" title="Tell us what to know." intro="Share the story if you’d like, plus the details that help everyone enjoy the table safely." /><div className="space-y-7"><div><FieldLabel hint="Optional">Where did it come from?</FieldLabel><input {...form.register('dishOrigin')} data-testid="input-dish-origin" placeholder="My grandmother’s kitchen, a rainy Tuesday…" className="input-keep" /></div><div><FieldLabel hint="Optional">What does it remind you of?</FieldLabel><textarea {...form.register('dishMemory')} data-testid="input-dish-memory" placeholder="The story behind this dish…" rows={3} className="input-keep resize-none" /></div><div><FieldLabel hint="Optional">What does the dish contain?</FieldLabel><textarea {...form.register('dishIngredients')} data-testid="input-dish-ingredients" placeholder="e.g. cashews, soy sauce, butter, sesame…" rows={3} className="input-keep resize-none" /></div><div><FieldLabel hint="Select all that apply">Dish labels</FieldLabel><div className="flex flex-wrap gap-2">{dishLabels.map((option) => <label key={option} className="cursor-pointer"><input type="checkbox" value={option} {...form.register('dishDietary')} data-testid={`checkbox-dish-${option.toLowerCase().replaceAll(' ', '-').replaceAll('/', '-')}`} className="peer sr-only" /><span className="inline-block rounded-full border border-border px-4 py-2 text-sm text-muted-foreground transition-colors peer-checked:border-primary peer-checked:bg-primary/10 peer-checked:font-semibold peer-checked:text-primary">{option}</span></label>)}</div></div><div className="rounded-2xl border border-border/80 bg-background/30 p-5"><FieldLabel hint="Select all that apply">What should we know about you?</FieldLabel><div className="flex flex-wrap gap-2">{guestNeeds.map((option) => <label key={option} className="cursor-pointer"><input type="checkbox" value={option} {...form.register('guestDietary')} data-testid={`checkbox-guest-${option.toLowerCase().replaceAll(' ', '-')}`} className="peer sr-only" /><span className="inline-block rounded-full border border-border px-4 py-2 text-sm text-muted-foreground transition-colors peer-checked:border-primary peer-checked:bg-primary/10 peer-checked:font-semibold peer-checked:text-primary">{option}</span></label>)}</div><div className="mt-5"><FieldLabel hint="Optional">Specific allergies or ingredients you need to avoid</FieldLabel><input {...form.register('guestAllergies')} data-testid="input-guest-allergies" placeholder="The host and other guests should know…" className="input-keep" /></div></div></div></div>;
}

function StepReview({ form, event, categories, attending, onEdit }: { form: ReturnType<typeof useForm<FormValues>>; event?: EventAvailability; categories: DishCategory[]; attending: boolean; onEdit: (step: number) => void }) {
  const values = form.getValues();
  const category = categories.find((item) => item.id === values.categoryId);
  const summary = (label: string, value: string, step: number) => <div className="flex items-start justify-between gap-4 px-5 py-4 text-sm"><div className="grid grid-cols-[90px_1fr] gap-3"><span className="font-mono text-[10px] uppercase tracking-[.13em] text-muted-foreground">{label}</span><span className="font-medium text-foreground">{value || '—'}</span></div><button type="button" onClick={() => onEdit(step)} className="focus-ring shrink-0 rounded-full px-2 py-1 text-xs font-semibold text-primary hover:bg-primary/10" data-testid={`button-edit-${step}`}>Edit</button></div>;
  return <div className="animate-rise"><StepHeading eyebrow="04 / Before we gather" title="Does this feel right?" intro="This is your final review. Check every answer, edit anything you like, then submit your RSVP." /><div className="divide-y divide-border/70 rounded-2xl border border-border bg-background/35">{summary('Name', values.name, 1)}{summary('Email', values.contact, 1)}{summary('Joining', attending ? 'Yes' : 'Not this time', 1)}{attending && <>{summary('Dish', `${values.dishName}${category ? ` · ${category.name}` : ''}`, 2)}{summary('Dish details', [values.dishIngredients, ...(values.dishDietary || [])].filter(Boolean).join(' · ') || 'No dish details added', 3)}{summary('Your needs', [...(values.guestDietary || []), values.guestAllergies].filter(Boolean).join(' · ') || 'No personal dietary notes', 3)}{summary('Story', values.dishMemory || values.dishOrigin || 'A story still being written', 3)}</>}</div><p className="mt-5 text-xs leading-relaxed text-muted-foreground">After you submit, we’ll email a copy of these answers to {values.contact || 'your email address'} with the Friendsgiving calendar invite{event ? ` for ${event.eventName}` : ''}.</p></div>;
}

function SuccessView({ event, rsvp }: { event?: EventAvailability; rsvp: Rsvp }) {
  const emailDelivered = (rsvp as { emailDelivered?: boolean }).emailDelivered !== false;
  return <Shell><main className="mx-auto max-w-4xl px-5 pb-20 pt-12 sm:px-8 lg:pt-20"><div className="relative overflow-hidden rounded-[2.5rem] bg-secondary px-7 py-14 text-center text-primary-foreground shadow-md sm:px-16 sm:py-20"><div className="absolute -left-16 -top-20 h-52 w-52 rounded-full border-[26px] border-primary/20" /><div className="absolute -bottom-24 -right-12 h-56 w-56 rounded-full border-[30px] border-accent/20" /><div className="relative animate-rise"><span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-accent text-secondary"><Check size={30} /></span><p className="mt-8 font-mono text-[10px] uppercase tracking-[.24em] text-accent">RSVP confirmed</p><h1 className="mx-auto mt-4 max-w-2xl font-serif text-5xl leading-[.95] sm:text-7xl">We’ll see you there, {rsvp.name.split(' ')[0]}.</h1><p className="mx-auto mt-6 max-w-md text-lg leading-relaxed text-primary-foreground/75">{emailDelivered ? <>A copy of your answers was sent to <strong>{rsvp.contact}</strong>, with the Friendsgiving calendar invite attached.</> : <>Your RSVP is saved. A copy of your answers is on its way to <strong>{rsvp.contact}</strong> — if it doesn’t land, don’t worry, Shay has everything.</>}</p><div className="mx-auto mt-10 max-w-sm border-t border-primary-foreground/20 pt-6 text-left text-sm text-primary-foreground/80"><p className="flex gap-3"><Clock3 size={17} className="shrink-0 text-accent" />{event ? <span>{formatEventDate(event.date)}<br />{event.time}</span> : <span>Event details are on their way</span>}</p><p className="mt-4 flex gap-3"><MapPin size={17} className="shrink-0 text-accent" />{event?.location ?? 'The usual place'}</p></div><Link href="/" data-testid="link-submit-another" className="focus-ring mt-10 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-bold text-primary-foreground transition-transform hover:-translate-y-0.5">Add another guest <ArrowRight size={16} /></Link></div></div></main></Shell>;
}

function GuestPage() {
  const eventQuery = useGetEventAvailability();
  const rsvpQuery = useListGuestRsvps();
  const event = eventQuery.data;
  const rsvps = rsvpQuery.data ?? [];
  const attending = rsvps.filter((rsvp) => rsvp.attending);
  return <Shell><main className="mx-auto max-w-7xl px-5 pb-20 pt-8 sm:px-8 lg:px-12 lg:pt-14"><div className="flex flex-col justify-between gap-8 border-b border-border/70 pb-10 md:flex-row md:items-end"><div className="animate-rise"><p className="font-mono text-[10px] uppercase tracking-[.22em] text-primary">The guests view</p><h1 className="mt-3 font-serif text-5xl leading-none tracking-[-.04em] text-secondary sm:text-7xl">Names around<br /><span className="italic text-primary">the table.</span></h1><p className="mt-5 max-w-lg text-muted-foreground">See who is coming, what they’re bringing, and the dietary details that help everyone feel looked after.</p></div><div className="rounded-2xl border border-card-border bg-card p-5 shadow-sm"><p className="font-mono text-[10px] uppercase tracking-[.18em] text-muted-foreground">Tonight’s gathering</p><p className="mt-2 font-serif text-2xl text-secondary">{event?.eventName ?? 'Loading event…'}</p><p className="mt-1 text-sm text-muted-foreground">{event ? `${formatEventDate(event.date)} · ${event.location}` : 'Event details loading'}</p></div></div>{eventQuery.isError || rsvpQuery.isError ? <div className="mt-10"><QueryError message="We couldn’t load the guest view." onRetry={() => { void eventQuery.refetch(); void rsvpQuery.refetch(); }} /></div> : eventQuery.isLoading || rsvpQuery.isLoading ? <OrganiserSkeleton /> : <><section className="mt-12"><div className="flex items-end justify-between gap-4"><div><p className="font-mono text-[10px] uppercase tracking-[.2em] text-primary">Everyone who’s coming</p><h2 className="mt-2 font-serif text-3xl text-secondary">Names around the table</h2></div><span className="rounded-full bg-muted px-3 py-1 font-mono text-[10px] uppercase tracking-[.12em] text-muted-foreground">{attending.length} coming</span></div><div className="mt-5 grid gap-3">{attending.length === 0 ? <div className="rounded-[1.5rem] border border-dashed border-border bg-card p-12 text-center"><Feather className="mx-auto text-primary" size={24} /><p className="mt-4 font-serif text-2xl text-secondary">The guest book is still blank.</p></div> : attending.map((rsvp) => <GuestSummaryRow key={rsvp.id} rsvp={rsvp} />)}</div></section><LocationMapSection /></>}</main></Shell>;
}

function LocationMapSection() {
  return <section className="mt-16 border-t border-border/70 pt-12"><div className="grid gap-8 lg:grid-cols-[.8fr_1.2fr] lg:items-start"><div><p className="font-mono text-[10px] uppercase tracking-[.2em] text-primary">After your RSVP</p><h2 className="mt-3 font-serif text-4xl leading-tight text-secondary">Find your way<br /><span className="italic text-primary">to the table.</span></h2><p className="mt-4 max-w-md text-muted-foreground">We’re gathering at NCPV in Kensington. Use the map for the exact pin, or open a transit route from either light rail stop.</p><div className="mt-7 space-y-3"><a href={directionsUrl('Central Station, Sydney NSW')} target="_blank" rel="noreferrer" className="focus-ring group flex items-center justify-between rounded-2xl border border-card-border bg-card p-4 shadow-sm transition-transform hover:-translate-y-0.5"><span className="flex items-center gap-3"><TrainFront className="text-primary" size={19} /><span><span className="block text-sm font-semibold text-secondary">Central Station → NCPV</span><span className="block text-xs text-muted-foreground">Open transit directions in Google Maps</span></span></span><ExternalLink size={16} className="text-muted-foreground transition-transform group-hover:translate-x-0.5" /></a><a href={directionsUrl('UNSW Randwick Light Rail Station, Sydney NSW')} target="_blank" rel="noreferrer" className="focus-ring group flex items-center justify-between rounded-2xl border border-card-border bg-card p-4 shadow-sm transition-transform hover:-translate-y-0.5"><span className="flex items-center gap-3"><TrainFront className="text-primary" size={19} /><span><span className="block text-sm font-semibold text-secondary">UNSW Randwick light rail → NCPV</span><span className="block text-xs text-muted-foreground">Open transit directions in Google Maps</span></span></span><ExternalLink size={16} className="text-muted-foreground transition-transform group-hover:translate-x-0.5" /></a></div><p className="mt-5 flex items-start gap-2 text-sm text-muted-foreground"><MapPin size={16} className="mt-0.5 shrink-0 text-primary" />215A Anzac Parade, Kensington NSW 2033</p></div><div className="overflow-hidden rounded-[2rem] border border-card-border bg-card p-2 shadow-sm"><iframe title="Map showing NCPV at 215A Anzac Parade, Kensington" src={mapEmbedUrl} className="h-[360px] w-full rounded-[1.5rem] border-0 sm:h-[430px]" loading="lazy" referrerPolicy="no-referrer-when-downgrade" /></div></div></section>;
}

function OrganiserPage() {
  const [unlocked, setUnlocked] = useState(false);
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const login = useLoginOrganiser();
  const unlock = () => {
    setAuthError('');
    login.mutate({ data: { password } }, { onSuccess: () => setUnlocked(true), onError: () => setAuthError('That password did not open the organiser view.') });
  };
  if (!unlocked) return <Shell><main className="mx-auto max-w-xl px-5 pb-20 pt-16 sm:px-8 lg:pt-24"><div className="rounded-[2rem] border border-card-border bg-card p-8 text-center shadow-sm sm:p-12"><span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-secondary text-primary-foreground"><Feather size={22} /></span><p className="mt-7 font-mono text-[10px] uppercase tracking-[.22em] text-primary">Private tab</p><h1 className="mt-3 font-serif text-5xl text-secondary">Organiser access</h1><p className="mt-4 text-muted-foreground">This is Shay’s private RSVP record. Enter the organiser password to see the complete details.</p><form onSubmit={(event) => { event.preventDefault(); unlock(); }} className="mt-8 text-left"><label className="text-sm font-bold text-secondary" htmlFor="organiser-password">Password</label><input id="organiser-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="input-keep mt-2" autoComplete="current-password" data-testid="input-organiser-password" /><button type="submit" disabled={login.isPending} className="focus-ring mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-bold text-primary-foreground disabled:opacity-60" data-testid="button-organiser-login">{login.isPending ? 'Opening…' : 'Open organiser view'} <ArrowRight size={16} /></button>{authError && <p className="mt-3 text-sm text-destructive" data-testid="status-organiser-auth-error">{authError}</p>}</form></div></main></Shell>;
  return <OrganiserDashboard />;
}

function OrganiserDashboard() {
  const availabilityQuery = useGetEventAvailability();
  const rsvpQuery = useListRsvps();
  const queryClientInstance = useQueryClient();
  const deleteRsvp = useDeleteRsvp();
  const event = availabilityQuery.data;
  const rsvps = rsvpQuery.data ?? [];
  const categories = event?.categories ?? [];
  const attending = rsvps.filter((rsvp) => rsvp.attending);
  const categoryMap = useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories]);
  const [editingRsvp, setEditingRsvp] = useState<Rsvp | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Rsvp | null>(null);
  const [actionError, setActionError] = useState('');

  const refreshRsvpViews = () => {
    void queryClientInstance.invalidateQueries({ queryKey: getListRsvpsQueryKey() });
    void queryClientInstance.invalidateQueries({ queryKey: getListGuestRsvpsQueryKey() });
    void queryClientInstance.invalidateQueries({ queryKey: getGetEventAvailabilityQueryKey() });
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    setActionError('');
    deleteRsvp.mutate({ id: deleteTarget.id }, {
      onSuccess: () => {
        setDeleteTarget(null);
        refreshRsvpViews();
      },
      onError: () => setActionError('We couldn’t delete that RSVP. Please try again.'),
    });
  };

  return <Shell><main className="mx-auto max-w-7xl px-5 pb-20 pt-8 sm:px-8 lg:px-12 lg:pt-14"><div className="flex flex-col justify-between gap-8 border-b border-border/70 pb-10 md:flex-row md:items-end"><div className="animate-rise"><p className="font-mono text-[10px] uppercase tracking-[.22em] text-primary">Private organiser view</p><h1 className="mt-3 font-serif text-5xl leading-none tracking-[-.04em] text-secondary sm:text-7xl">Every RSVP,<br /><span className="italic text-primary">encapsulated.</span></h1><p className="mt-5 max-w-lg text-muted-foreground">Edit or remove any RSVP directly here. Changes update the shared guest view too.</p></div><div className="rounded-2xl border border-card-border bg-card p-5 shadow-sm"><p className="font-mono text-[10px] uppercase tracking-[.18em] text-muted-foreground">Tonight’s gathering</p><p className="mt-2 font-serif text-2xl text-secondary">{event?.eventName ?? 'Loading event…'}</p><p className="mt-1 text-sm text-muted-foreground">{event ? `${formatEventDate(event.date)} · ${event.location}` : 'Event details loading'}</p></div></div>{availabilityQuery.isError || rsvpQuery.isError ? <div className="mt-10"><QueryError message="We couldn’t load the organiser view." onRetry={() => { void availabilityQuery.refetch(); void rsvpQuery.refetch(); }} /></div> : availabilityQuery.isLoading || rsvpQuery.isLoading ? <OrganiserSkeleton /> : <><div className="mt-10 grid gap-4 sm:grid-cols-3"><Metric label="Confirmed attendees" value={String(attending.length)} note={`${attending.length} RSVP${attending.length === 1 ? '' : 's'}`} icon={<Users size={18} />} /><Metric label="Full details" value={String(rsvps.length)} note="private RSVP records" icon={<Feather size={18} />} /><Metric label="Categories open" value={String(categories.filter((category) => category.remaining > 0).length)} note="still welcoming dishes" icon={<UtensilsCrossed size={18} />} /></div><section className="mt-12"><div><p className="font-mono text-[10px] uppercase tracking-[.2em] text-primary">Live balance</p><h2 className="mt-2 font-serif text-3xl text-secondary">What’s coming to the table</h2></div><div className="mt-5 grid gap-3 md:grid-cols-2">{categories.map((category) => <CategoryBalance key={category.id} category={category} />)}</div></section><section className="mt-14"><div className="flex items-end justify-between gap-4"><div><p className="font-mono text-[10px] uppercase tracking-[.2em] text-primary">Private guest book</p><h2 className="mt-2 font-serif text-3xl text-secondary">Complete RSVP details</h2></div><span className="rounded-full bg-muted px-3 py-1 font-mono text-[10px] uppercase tracking-[.12em] text-muted-foreground">{rsvps.length} submitted</span></div><div className="mt-5 grid gap-3">{rsvps.map((rsvp) => <OrganiserRow key={rsvp.id} rsvp={rsvp} category={categoryMap.get(rsvp.categoryId)} onEdit={() => { setActionError(''); setEditingRsvp(rsvp); }} onDelete={() => { setActionError(''); setDeleteTarget(rsvp); }} />)}</div></section></>}</main>{editingRsvp && <OrganiserEditModal key={editingRsvp.id} rsvp={editingRsvp} categories={categories} onClose={() => setEditingRsvp(null)} onSaved={() => { setEditingRsvp(null); refreshRsvpViews(); }} />}{deleteTarget && <DeleteRsvpModal rsvp={deleteTarget} isPending={deleteRsvp.isPending} error={actionError} onCancel={() => setDeleteTarget(null)} onConfirm={confirmDelete} />}</Shell>;
}

function OrganiserSkeleton() {
  return <div className="mt-10 space-y-8" data-testid="state-loading-organiser"><div className="grid gap-4 sm:grid-cols-3">{[1, 2, 3].map((item) => <div key={item} className="h-28 animate-pulse rounded-2xl bg-muted" />)}</div><div className="h-48 animate-pulse rounded-2xl bg-muted" /><div className="h-40 animate-pulse rounded-2xl bg-muted" /></div>;
}

function Metric({ label, value, note, icon }: { label: string; value: string; note: string; icon: ReactNode }) {
  return <div className="rounded-2xl border border-card-border bg-card p-5 shadow-sm"><div className="flex items-center justify-between text-primary"><span className="font-mono text-[10px] uppercase tracking-[.15em] text-muted-foreground">{label}</span>{icon}</div><p className="mt-3 font-serif text-4xl text-secondary">{value}</p><p className="mt-1 text-xs text-muted-foreground">{note}</p></div>;
}

function CategoryBalance({ category }: { category: DishCategory }) {
  const progress = Math.min(100, (category.claimed / Math.max(category.target, 1)) * 100);
  return <div className="rounded-2xl border border-card-border bg-card p-5 shadow-sm"><div className="flex items-start justify-between gap-5"><div><span className="font-mono text-[10px] uppercase tracking-[.15em] text-primary">{category.shortName}</span><h3 className="mt-1 font-serif text-2xl text-secondary">{category.name}</h3><p className="mt-1 text-sm text-muted-foreground">{category.description}</p></div><span className={`rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-[.1em] ${category.remaining ? 'bg-accent/40 text-secondary' : 'bg-muted text-muted-foreground'}`}>{category.remaining ? `${category.remaining} open` : 'Full'}</span></div><div className="mt-5 flex items-center gap-3"><div className="h-2 flex-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} /></div><span className="font-mono text-[10px] text-muted-foreground">{category.claimed}/{category.target}</span></div></div>;
}

function OrganiserEditModal({ rsvp, categories, onClose, onSaved }: { rsvp: Rsvp; categories: DishCategory[]; onClose: () => void; onSaved: () => void }) {
  const form = useForm<FormValues>({ defaultValues: rsvpToFormValues(rsvp), mode: 'onTouched' });
  const updateRsvp = useUpdateRsvp();
  const attending = form.watch('attending');
  const selectedCategory = form.watch('categoryId');
  const availableCategories = categories.filter((category) => category.remaining > 0 || category.id === rsvp.categoryId);
  const guestNeeds = ['Everything', 'Vegetarian', 'Vegan', 'Halal', 'No beef', 'No pork', 'No seafood', 'Gluten-free', 'Other'];
  const dishLabels = ['Contains nuts', 'Contains soy', 'Contains lactose / dairy', 'Contains gluten', 'Vegetarian', 'Vegan', 'Halal', 'Kosher', 'No beef', 'No pork', 'No seafood'];

  useEffect(() => {
    form.reset(rsvpToFormValues(rsvp));
  }, [form, rsvp]);

  const submit = form.handleSubmit((values) => {
    const payload: FormValues = attending
      ? { ...values, guests: 0 }
      : { ...values, attending: false, guests: 0, categoryId: 'declined', dishName: '', dishOrigin: '', dishMemory: '', guestDietary: [], guestAllergies: '', dishIngredients: '', dishDietary: [] };
    updateRsvp.mutate({ id: rsvp.id, data: payload }, {
      onSuccess: onSaved,
    });
  });

  return <div className="fixed inset-0 z-40 overflow-y-auto bg-secondary/55 px-4 py-6 backdrop-blur-sm sm:px-6 sm:py-10" role="dialog" aria-modal="true" aria-labelledby="edit-rsvp-title"><div className="mx-auto max-w-3xl rounded-[2rem] border border-card-border bg-card p-6 shadow-2xl sm:p-10"><div className="flex items-start justify-between gap-6 border-b border-border/70 pb-6"><div><p className="font-mono text-[10px] uppercase tracking-[.2em] text-primary">Organiser controls</p><h2 id="edit-rsvp-title" className="mt-2 font-serif text-4xl text-secondary">Edit {rsvp.name}&apos;s RSVP</h2><p className="mt-2 text-sm text-muted-foreground">Changes save directly to the shared guest list.</p></div><button type="button" onClick={onClose} className="focus-ring rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Close edit RSVP"><X size={20} /></button></div><Form {...form}><form onSubmit={submit} className="mt-7 space-y-7"><div className="grid gap-5 sm:grid-cols-2"><div><FieldLabel>Name</FieldLabel><input {...form.register('name', { required: 'Name is required' })} className="input-keep" data-testid="input-edit-rsvp-name" />{form.formState.errors.name && <p className="field-error">{form.formState.errors.name.message}</p>}</div><div><FieldLabel>Email address</FieldLabel><input type="email" autoComplete="email" {...form.register('contact', { required: 'Email address is required', pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Enter a valid email address' } })} className="input-keep" data-testid="input-edit-rsvp-email" />{form.formState.errors.contact && <p className="field-error">{form.formState.errors.contact.message}</p>}</div></div><div><FieldLabel>Attendance</FieldLabel><div className="grid gap-3 sm:grid-cols-2"><label className={`choice-card ${attending ? 'choice-card-selected' : ''}`}><input type="radio" checked={attending} onChange={() => form.setValue('attending', true, { shouldDirty: true })} /> <span><strong>Coming</strong><small>Keep this person on the table plan</small></span></label><label className={`choice-card ${!attending ? 'choice-card-selected' : ''}`}><input type="radio" checked={!attending} onChange={() => form.setValue('attending', false, { shouldDirty: true })} /> <span><strong>Can’t make it</strong><small>Keep their response for your records</small></span></label></div></div>{attending && <><div><FieldLabel>Dish category and name</FieldLabel><div className="grid gap-3">{availableCategories.map((category) => <button type="button" key={category.id} onClick={() => form.setValue('categoryId', category.id, { shouldDirty: true })} className={`rounded-2xl border p-4 text-left transition-colors ${selectedCategory === category.id ? 'border-primary bg-primary/7' : 'border-border hover:border-primary/50'}`}><div className="flex items-start justify-between gap-3"><span><span className="font-mono text-[10px] uppercase tracking-[.15em] text-primary">{category.shortName}</span><span className="mt-1 block font-serif text-xl text-secondary">{category.name}</span></span><span className="rounded-full bg-muted px-2 py-1 font-mono text-[10px] text-muted-foreground">{category.id === rsvp.categoryId ? 'current' : `${category.remaining} open`}</span></div></button>)}</div>{form.formState.errors.categoryId && <p className="field-error">{form.formState.errors.categoryId.message}</p>}<input {...form.register('categoryId', { required: 'Choose a category' })} type="hidden" /><input {...form.register('dishName', { required: 'Dish name is required' })} className="input-keep mt-4" placeholder="Dish name" data-testid="input-edit-rsvp-dish-name" />{form.formState.errors.dishName && <p className="field-error">{form.formState.errors.dishName.message}</p>}</div><div className="grid gap-5 sm:grid-cols-2"><div><FieldLabel hint="Optional">Where did it come from?</FieldLabel><input {...form.register('dishOrigin')} className="input-keep" data-testid="input-edit-rsvp-origin" /></div><div><FieldLabel hint="Optional">What does it remind you of?</FieldLabel><input {...form.register('dishMemory')} className="input-keep" data-testid="input-edit-rsvp-memory" /></div></div><div><FieldLabel hint="Optional">What does the dish contain?</FieldLabel><textarea {...form.register('dishIngredients')} rows={2} className="input-keep resize-none" data-testid="input-edit-rsvp-ingredients" /></div><div><FieldLabel hint="Select all that apply">Dish labels</FieldLabel><div className="flex flex-wrap gap-2">{dishLabels.map((option) => <label key={option} className="cursor-pointer"><input type="checkbox" value={option} {...form.register('dishDietary')} className="peer sr-only" /><span className="inline-block rounded-full border border-border px-3 py-2 text-sm text-muted-foreground transition-colors peer-checked:border-primary peer-checked:bg-primary/10 peer-checked:font-semibold peer-checked:text-primary">{option}</span></label>)}</div></div><div className="rounded-2xl border border-border/80 bg-background/30 p-5"><FieldLabel hint="Select all that apply">Guest dietary requirements</FieldLabel><div className="flex flex-wrap gap-2">{guestNeeds.map((option) => <label key={option} className="cursor-pointer"><input type="checkbox" value={option} {...form.register('guestDietary')} className="peer sr-only" /><span className="inline-block rounded-full border border-border px-3 py-2 text-sm text-muted-foreground transition-colors peer-checked:border-primary peer-checked:bg-primary/10 peer-checked:font-semibold peer-checked:text-primary">{option}</span></label>)}</div><input {...form.register('guestAllergies')} className="input-keep mt-4" placeholder="Specific allergies or ingredients to avoid" data-testid="input-edit-rsvp-allergies" /></div></>}{updateRsvp.isError && <p className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">We couldn’t save that edit. The category may have filled up, or the connection may have dropped.</p>}<div className="flex flex-col-reverse justify-end gap-3 border-t border-border/70 pt-6 sm:flex-row"><button type="button" onClick={onClose} className="focus-ring rounded-full px-5 py-3 text-sm font-semibold text-muted-foreground hover:text-foreground">Cancel</button><button type="submit" disabled={updateRsvp.isPending} className="focus-ring inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-bold text-primary-foreground disabled:opacity-60" data-testid="button-save-rsvp">{updateRsvp.isPending ? 'Saving…' : 'Save changes'} <Save size={16} /></button></div></form></Form></div></div>;
}

function DeleteRsvpModal({ rsvp, isPending, error, onCancel, onConfirm }: { rsvp: Rsvp; isPending: boolean; error: string; onCancel: () => void; onConfirm: () => void }) {
  return <div className="fixed inset-0 z-40 grid place-items-center bg-secondary/55 px-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="delete-rsvp-title"><div className="w-full max-w-md rounded-[2rem] border border-card-border bg-card p-7 shadow-2xl sm:p-9"><div className="flex items-start justify-between gap-5"><div><p className="font-mono text-[10px] uppercase tracking-[.2em] text-destructive">Remove RSVP</p><h2 id="delete-rsvp-title" className="mt-2 font-serif text-3xl text-secondary">Delete {rsvp.name}&apos;s response?</h2></div><button type="button" onClick={onCancel} className="focus-ring rounded-full p-2 text-muted-foreground hover:bg-muted" aria-label="Close delete confirmation"><X size={19} /></button></div><p className="mt-4 text-sm leading-relaxed text-muted-foreground">This will remove the RSVP from the organiser records, category availability, and the public guest list. This cannot be undone from the website.</p>{error && <p className="mt-4 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{error}</p>}<div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><button type="button" onClick={onCancel} className="focus-ring rounded-full px-5 py-3 text-sm font-semibold text-muted-foreground hover:text-foreground">Keep RSVP</button><button type="button" onClick={onConfirm} disabled={isPending} className="focus-ring inline-flex items-center justify-center gap-2 rounded-full bg-destructive px-5 py-3 text-sm font-bold text-destructive-foreground disabled:opacity-60" data-testid="button-confirm-delete-rsvp">{isPending ? 'Deleting…' : 'Delete RSVP'} <Trash2 size={16} /></button></div></div></div>;
}

function GuestSummaryRow({ rsvp }: { rsvp: GuestRsvp }) {
  return <article className="rounded-2xl border border-card-border bg-card p-5 shadow-sm transition-transform hover:-translate-y-0.5" data-testid={`row-guest-${rsvp.id}`}><div className="grid gap-5 md:grid-cols-[1fr_1fr_1.2fr] md:items-center"><div className="flex items-center gap-4"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-accent font-serif text-lg text-secondary">{rsvp.name.charAt(0).toUpperCase()}</span><div><span className="font-mono text-[10px] uppercase tracking-[.12em] text-muted-foreground">Name</span><h3 className="mt-1 font-serif text-2xl text-secondary">{rsvp.name}</h3></div></div><div><span className="font-mono text-[10px] uppercase tracking-[.12em] text-muted-foreground">Bringing</span><p className="mt-1 font-semibold text-foreground">{rsvp.dishName || 'A surprise dish'}</p></div><div><span className="font-mono text-[10px] uppercase tracking-[.12em] text-muted-foreground">Dietary requirements</span><p className="mt-1 text-foreground">{[...(rsvp.guestDietary ?? []), rsvp.guestAllergies].filter(Boolean).join(' · ') || 'None shared'}</p></div></div></article>;
}

function OrganiserRow({ rsvp, category, onEdit, onDelete }: { rsvp: Rsvp; category?: DishCategory; onEdit: () => void; onDelete: () => void }) {
  const [emailState, setEmailState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const resendEmail = async () => {
    setEmailState('sending');
    try {
      const res = await fetch(`/api/rsvps/${rsvp.id}/resend`, { method: 'POST', headers: { accept: 'application/json' } });
      setEmailState(res.ok ? 'sent' : 'error');
    } catch {
      setEmailState('error');
    }
  };
  const resendLabel = emailState === 'sending' ? 'Sending…' : emailState === 'sent' ? 'Email sent' : emailState === 'error' ? 'Failed — retry' : 'Resend email';
  return <article className="rounded-2xl border border-card-border bg-card p-5 shadow-sm transition-transform hover:-translate-y-0.5" data-testid={`row-rsvp-${rsvp.id}`}><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div className="flex gap-4"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-accent font-serif text-lg text-secondary">{rsvp.name.charAt(0).toUpperCase()}</span><div><h3 className="font-serif text-2xl text-secondary">{rsvp.name}</h3><p className="mt-1 text-xs text-muted-foreground">Email: {rsvp.contact}</p></div></div><div className="flex flex-wrap items-center gap-2"><span className={`w-fit rounded-full px-3 py-1 font-mono text-[10px] uppercase tracking-[.12em] ${rsvp.attending ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>{rsvp.attending ? 'Coming' : 'Can’t make it'}</span><button type="button" onClick={() => void resendEmail()} disabled={emailState === 'sending'} className={`focus-ring inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-60 ${emailState === 'error' ? 'border-destructive/30 text-destructive hover:bg-destructive/10' : emailState === 'sent' ? 'border-primary text-primary' : 'border-border text-secondary hover:border-primary hover:text-primary'}`} data-testid={`button-resend-rsvp-${rsvp.id}`}><Mail size={13} /> {resendLabel}</button><button type="button" onClick={onEdit} className="focus-ring inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-secondary transition-colors hover:border-primary hover:text-primary" data-testid={`button-edit-rsvp-${rsvp.id}`}><Pencil size={13} /> Edit</button><button type="button" onClick={onDelete} className="focus-ring inline-flex items-center gap-1.5 rounded-full border border-destructive/30 px-3 py-1.5 text-xs font-semibold text-destructive transition-colors hover:bg-destructive/10" data-testid={`button-delete-rsvp-${rsvp.id}`}><Trash2 size={13} /> Delete</button></div></div>{rsvp.attending && <div className="mt-5 grid gap-4 border-t border-border/70 pt-4 text-sm md:grid-cols-2"><div><span className="font-mono text-[10px] uppercase tracking-[.12em] text-muted-foreground">Bringing</span><p className="mt-1 font-semibold text-foreground">{rsvp.dishName || 'A surprise dish'} <span className="font-normal text-muted-foreground">· {category?.name ?? 'Category pending'}</span></p></div><div><span className="font-mono text-[10px] uppercase tracking-[.12em] text-muted-foreground">Dish details</span><p className="mt-1 text-foreground">{[rsvp.dishIngredients, ...(rsvp.dishDietary ?? [])].filter(Boolean).join(' · ') || 'No dish details added'}</p></div><div><span className="font-mono text-[10px] uppercase tracking-[.12em] text-muted-foreground">Guest needs</span><p className="mt-1 text-foreground">{[...(rsvp.guestDietary ?? []), rsvp.guestAllergies].filter(Boolean).join(' · ') || 'No personal dietary notes'}</p></div><div><span className="font-mono text-[10px] uppercase tracking-[.12em] text-muted-foreground">Story</span><p className="mt-1 font-serif text-lg italic text-secondary">{rsvp.dishMemory || rsvp.dishOrigin || 'A story still being written'}</p></div></div>}</article>;
}

function Router() {
  const [currentLocation] = useLocation();
  return <ErrorBoundary resetKey={currentLocation}><Switch><Route path="/" component={RsvpPage} /><Route path="/guest" component={GuestPage} /><Route path="/organiser" component={OrganiserPage} /><Route component={NotFound} /></Switch></ErrorBoundary>;
}

function App() {
  return <QueryClientProvider client={queryClient}><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Router /></WouterRouter></QueryClientProvider>;
}

export default App;