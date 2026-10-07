import { useEffect, useState, useRef, useMemo } from 'react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Menu, X, Sparkles } from 'lucide-react';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import { AnimatePresence, motion, useScroll, useTransform, useReducedMotion, useMotionValueEvent } from 'framer-motion';
import { ArtistCard } from '@/components/ArtistCard';
import { HeroSearch, type HeroSearchValue } from '@/components/HeroSearch';
import { type Artist } from './Data/dummyArtists';
import { ProfileModal } from '@/components/ProfileModal';
import { AuthModal } from '@/components/AuthModal';
import NotFound from '@/pages/not-found';
import { supabase } from './lib/supabase';
import { Session } from '@supabase/supabase-js';
import Dashboard from './pages/Dashboard';
import { artistsData as artists } from './Data/artistsData';
import BeautyDemo from '@/pages/ArtistProfile';
import { ChatDrawer } from '@/components/ChatDrawer';
import { Reveal } from '@/components/Reveal';
import { Premium } from '@/components/Premium';
import { getTheme } from '@/lib/theme';
import { ArtistBookings } from './components/ArtistBookings';
import { ClientBookings } from './components/ClientBookings';
import { Search, PlusCircle, BookOpen} from 'lucide-react';
import { extractTagsFromText } from './lib/matching';

// ─── NEW AI MATCHING ENGINE IMPORTS ────────────────────────────────────────────
import { useReferenceMatching } from './hooks/useReferenceMatching';
import { AIMatchPanel } from './components/AIMatchPanel';
import { runCanvasMatch, legacyTagsToStructured } from './lib/matching';
// ───────────────────────────────────────────────────────────────────────────────

// ==========================================
// TEXT FORMATTING: TITLE CASE
// ==========================================
const TITLE_CASE_MINOR_WORDS = new Set([
  'a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'if', 'in',
  'nor', 'of', 'on', 'or', 'so', 'the', 'to', 'up', 'yet', 'with',
]);

const TITLE_CASE_ACRONYMS: Record<string, string> = {
  ai: 'AI',
  faq: 'FAQ',
  faqs: 'FAQs',
  hd: 'HD',
};

function toTitleCase(input: string): string {
  if (!input) return input;
  return input
    .split(' ')
    .map((word, index, words) => {
      if (!word) return word;
      if (/[A-Z]/.test(word.slice(1))) return word;
      const lower = word.toLowerCase();
      if (TITLE_CASE_ACRONYMS[lower]) return TITLE_CASE_ACRONYMS[lower];
      const isEdge = index === 0 || index === words.length - 1;
      if (!isEdge && TITLE_CASE_MINOR_WORDS.has(lower)) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1).replace(/-([a-z])/g, (_, c) => `-${c.toUpperCase()}`);
    })
    .join(' ');
}

// ==========================================
// PERFORMANCE OPTIMIZED SCROLL WRAPPERS
// ==========================================
function ScrollZoom({ children, className }: { children: React.ReactNode; className?: string; delay?: number }) {
  return <div className={className}>{children}</div>;
}
function ScrollZoomIn({ children, className }: { children: React.ReactNode; className?: string; delay?: number }) {
  return <div className={className}>{children}</div>;
}

const queryClient = new QueryClient();

const discoverCategories = [
  { id: 'all', label: 'all artists' },
  { id: 'Bridal & Wedding', label: 'bridal & wedding' },
  { id: 'Party & Event Glam', label: 'party & event glam' },
  { id: 'Natural & Soft Aesthetics', label: 'natural & soft aesthetics' },
  { id: 'Editorial & High Fashion', label: 'editorial & high fashion' },
  { id: 'Specialized Skin & Grooming', label: 'specialized skin & grooming' },
];

const BG_PARALLAX_FACTOR = 0.15;
const BG_PARALLAX_MAX_PX = 160;
const GRID_PARALLAX_FACTOR = -0.06;
const GRID_PARALLAX_MAX_PX = 70;

const PLACEHOLDER_IMG =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 500">
       <rect width="400" height="500" fill="#150A26"/>
       <text x="50%" y="50%" font-family="serif" font-size="26" fill="#6B3C9C"
         text-anchor="middle" dominant-baseline="middle" letter-spacing="4">CANVAS</text>
     </svg>`
  );

function handleImgError(e: React.SyntheticEvent<HTMLImageElement>) {
  const img = e.currentTarget;
  if (img.src === PLACEHOLDER_IMG) return;
  img.onerror = null;
  img.src = PLACEHOLDER_IMG;
}

function normalizePortfolio(
  portfolio: any[] | null | undefined,
  fallbackImage: string
): { style: string; image: string }[] {
  const raw = portfolio || [];
  if (raw.length === 0) {
    return [{ style: 'signature work', image: fallbackImage }];
  }
  return raw.map((p: any, i: number) => {
    if (typeof p === 'string') {
      return { style: `look n°${String(i + 1).padStart(2, '0')}`, image: p };
    }
    return {
      style: p?.style || `look n°${String(i + 1).padStart(2, '0')}`,
      image: p?.image || fallbackImage,
    };
  });
}

const INDIAN_CITIES = [
  'Mumbai', 'Delhi', 'Bengaluru', 'Hyderabad', 'Pune', 'Chennai', 'Kolkata', 'Ahmedabad', 'Surat', 'Jaipur',
  'Lucknow', 'Kanpur', 'Nagpur', 'Indore', 'Thane', 'Bhopal', 'Visakhapatnam', 'Pimpri-Chinchwad', 'Patna', 'Vadodara',
  'Ghaziabad', 'Ludhiana', 'Agra', 'Nashik', 'Faridabad', 'Meerut', 'Rajkot', 'Kalyan-Dombivli', 'Vasai-Virar', 'Varanasi',
  'Srinagar', 'Aurangabad', 'Dhanbad', 'Amritsar', 'Navi Mumbai', 'Allahabad', 'Howrah', 'Ranchi', 'Gwalior', 'Jabalpur',
  'Coimbatore', 'Vijayawada', 'Jodhpur', 'Madurai', 'Raipur', 'Kota', 'Guwahati', 'Chandigarh', 'Solapur', 'Hubli-Dharwad',
  'Bareilly', 'Moradabad', 'Mysore', 'Gurgaon', 'Aligarh', 'Jalandhar', 'Tiruchirappalli', 'Bhubaneswar', 'Salem', 'Mira-Bhayandar',
  'Warangal', 'Thiruvananthapuram', 'Bhiwandi', 'Saharanpur', 'Guntur', 'Amravati', 'Bikaner', 'Noida', 'Jamshedpur', 'Bhilai',
  'Cuttack', 'Firozabad', 'Kochi', 'Nellore', 'Bhavnagar', 'Dehradun', 'Durgapur', 'Asansol', 'Rourkela', 'Nanded',
  'Kolhapur', 'Ajmer', 'Akola', 'Gulbarga', 'Jamnagar', 'Ujjain', 'Loni', 'Siliguri', 'Jhansi', 'Ulhasnagar',
  'Jammu', 'Sangli-Miraj', 'Mangalore', 'Erode', 'Belgaum', 'Ambattur', 'Tirunelveli', 'Malegaon', 'Gaya', 'Jalgaon',
  'Udaipur', 'Maheshtala', 'Davanagere', 'Kozhikode', 'Kurnool', 'Rajahmundry', 'Bokaro', 'South Dumdum', 'Bellary', 'Patiala',
  'Gopalpur', 'Agartala', 'Bhagalpur', 'Muzaffarnagar', 'Bhatpara', 'Panihati', 'Latur', 'Dhule', 'Tirupati', 'Rohtak',
  'Korba', 'Bhilwara', 'Berhampur', 'Muzaffarpur', 'Ahmednagar', 'Mathura', 'Kollam', 'Avadi', 'Kadapa', 'Kamarhati',
  'Sambalpur', 'Bilaspur', 'Shahjahanpur', 'Satara', 'Bijapur', 'Rampur', 'Shivamogga', 'Chandrapur', 'Junagadh', 'Thrissur',
  'Alwar', 'Bardhaman', 'Kulti', 'Kakinada', 'Nizamabad', 'Parbhani', 'Tumkur', 'Khammam', 'Ozhukarai', 'Bihar Sharif',
  'Panipat', 'Darbhanga', 'Bally', 'Aizawl', 'Dewas', 'Ichalkaranji', 'Karnal', 'Bathinda', 'Jalna', 'Eluru',
  'Barasat', 'Purnia', 'Satna', 'Mau', 'Sonipat', 'Farrukhabad', 'Sagar', 'Durg', 'Imphal', 'Ratlam',
  'Hapur', 'Arrah', 'Karimnagar', 'Anantapur', 'Etawah', 'Ambernath', 'North Dumdum', 'Bharatpur', 'Begusarai', 'New Delhi',
  'Gandhidham', 'Baranagar', 'Tiruvottiyur', 'Pondicherry', 'Sikar', 'Thoothukudi', 'Rewa', 'Mirzapur', 'Raichur', 'Pali',
  'Ramagundam', 'Haridwar', 'Vijayanagaram', 'Katihar', 'Nagarcoil', 'Sri Ganganagar', 'Mango', 'Thanjavur', 'Bulandshahr', 'Uluberia',
  'Murwara', 'Sambhal', 'Singrauli', 'Nadiad', 'Secunderabad', 'Naihati', 'Yamunanagar', 'Bidhannagar', 'Pallavaram', 'Bidar',
  'Munger', 'Panchkula', 'Burhanpur', 'Kharagpur', 'Dindigul', 'Gandhinagar', 'Hospet', 'Nangloi Jat', 'Malda', 'Ongole',
  'Deoghar', 'Chapra', 'Haldia', 'Khandwa', 'Nandyal', 'Chittoor', 'Morena', 'Amroha', 'Anand', 'Bhind',
  'Bhiwani', 'Navghar-Manikpur', 'Baharampur', 'Ambala', 'Morvi', 'Fatehpur', 'Rae Bareli', 'Khora', 'Bhusawal', 'Orai',
  'Bahraich', 'Vellore', 'Mahesana', 'Raiganj', 'Sirsa', 'Danapur', 'Serampore', 'Guna', 'Jaunpur', 'Panvel',
  'Shivpuri', 'Unnao', 'Chinsurah', 'Alappuzha', 'Kottayam', 'Machilipatnam', 'Shimla', 'Adoni', 'Udupi', 'Proddatur',
  'Mahbubnagar', 'Saharsa', 'Dibrugarh', 'Jorhat', 'Nagaon', 'Tinsukia', 'Silchar', 'Bongaigaon', 'Tezpur', 'Kohima',
  'Dimapur', 'Shillong', 'Tura', 'Gangtok', 'Itanagar', 'Naharlagun', 'Pasighat', 'Lunglei', 'Dharmanagar', 'Port Blair',
  'Kavaratti', 'Daman', 'Diu', 'Silvassa', 'Panaji', 'Margao', 'Vasco da Gama', 'Mapusa', 'Ponda', 'Karwar',
  'Gokak', 'Shahabad', 'Sirsi', 'Sindhnur', 'Tiptur', 'Chitradurga', 'Hassan', 'Mandya', 'Chikkamagaluru', 'Bagalkot',
  'Gadag-Betageri', 'Bhadravati', 'Kolar', 'Moga', 'Abohar', 'Pathankot', 'Hoshiarpur', 'Batala', 'Khanna', 'Phagwara',
  'Muktsar', 'Barnala', 'Rajpura', 'Firozpur', 'Kapurthala', 'Sunam', 'Gurdaspur', 'Fazilka', 'Tarn Taran', 'Jagraon',
  'Mandi Gobindgarh', 'Rupnagar', 'Puri', 'Balasore', 'Bhadrak', 'Baripada', 'Jharsuguda', 'Bargarh', 'Rayagada', 'Kendrapara',
  'Malkangiri', 'Parlakhemundi', 'Bobbili', 'Tuni', 'Chilakaluripet', 'Narsaraopet', 'Kavali', 'Gudur', 'Tenali', 'Mangalagiri',
  'Bapatla', 'Ponnur', 'Narasapur', 'Tadepalligudem', 'Bhimavaram', 'Palakollu', 'Tanuku', 'Mandapeta', 'Amalapuram', 'Pithapuram',
  'Samalkota', 'Tadipatri', 'Dharmavaram', 'Hindupur', 'Kadiri', 'Guntakal', 'Rayachoti', 'Rajampet', 'Madanapalle', 'Punganur',
  'Srikalahasti', 'Puttur', 'Palasa Kasibugga', 'Parvathipuram', 'Yemmiganur', 'Rayadurg', 'Kalyandurg', 'Nuzvid', 'Jaggaiahpet', 'Macherla',
  'Sattenapalle', 'Vinukonda', 'Markapur', 'Kandukur', 'Yerraguntla', 'Jammalamadugu', 'Badvel', 'Mydukur', 'Pulivendula', 'Giddalur',
  'Atmakur', 'Nandikotkur', 'Allagadda', 'Nandigama', 'Vuyyuru', 'Pedana', 'Gudivada', 'Amadalavalasa', 'Ichchapuram', 'Ramachandrapuram',
  'Kothapeta', 'Kovvur', 'Nidadavole', 'Jangareddygudem', 'Chintalapudi', 'Kondapalli', 'Tiruvuru', 'Repalle', 'Tadepalle', 'Piduguralla',
  'Addanki', 'Chirala', 'Venkatagiri', 'Nagari', 'Palamaner', 'Kuppam', 'Dhone', 'Banaganapalle', 'Bapatla', 'Tenali'
];

const local100Artists: Artist[] = artists.slice(0, 100).map((a: any, index: number) => {
  const profileImg = a.image || a.portfolio?.[0]?.image || a.portfolio?.[0] || 'https://images.unsplash.com/photo-1596704017254-9b121068fb31?auto=format&fit=crop&w=800&q=80';
  const normalizedPortfolio = normalizePortfolio(a.portfolio, profileImg);
  const assignedCity = INDIAN_CITIES[(index * 7) % INDIAN_CITIES.length];
  return {
    id: String(a.id),
    name: a.name,
    category: a.category || 'Bridal & Wedding',
    services: [a.specialty || 'Makeup Artist', 'Makeup Artist'],
    city: assignedCity,
    location: `${assignedCity}, India`,
    maxTravelKm: 50,
    pricePerSession: a.pricePerSession || 15000,
    startingPrice: a.startingPrice || `₹15,000`,
    rating: a.rating || 4.9,
    reviewCount: a.reviewsCount || 24,
    reviewsCount: a.reviewsCount || 24,
    image: profileImg,
    hoverImage: normalizedPortfolio[1]?.image || normalizedPortfolio[0]?.image || profileImg,
    tags: a.tags || [a.specialty || 'Custom Styling'],
    bio: a.bio || `Expert in ${a.specialty}. Available for bookings.`,
    signature: a.specialty || 'Signature Aesthetic',
    portfolio: normalizedPortfolio,
    addons: a.addons || [],
    isVerified: true,
  };
});

// ==========================================
// MAGAZINE BLEED HERO VISUAL
// ==========================================
function CanvasVisualEditorial({ theme }: { theme: any }) {
  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-visible">
      <div className="absolute -top-10 right-0 w-[420px] h-[420px] bg-[#C9A463]/25 rounded-full blur-[110px]" />
      <div className="absolute bottom-0 left-0 w-[380px] h-[380px] bg-[#4A2A6B]/30 rounded-full blur-[120px]" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: [0, -12, 0] }}
        transition={{
          opacity: { duration: 1 },
          y: { duration: 7, repeat: Infinity, ease: 'easeInOut' },
        }}
        className="relative z-10 flex flex-col items-center"
      >
        <img
          src="/logo.png"
          alt="Canvas"
          className="w-[200px] sm:w-[280px] md:w-[380px] lg:w-[440px] object-contain drop-shadow-[0_30px_60px_rgba(74,42,107,0.25)]"
        />

        <div className="flex flex-col items-center mt-6">
          <span className={`${theme.eyebrow} mb-3 text-center`}>
            {toTitleCase('the canvas standard')}
          </span>
          <div className="h-[1px] w-12 bg-gradient-to-r from-transparent via-black/20 to-transparent mb-3" />
          <p className={`${theme.premiumTag} text-sm md:text-base text-center [word-spacing:0.3em]`}>
            {toTitleCase('curated private roster')}
          </p>
        </div>
      </motion.div>
    </div>
  );
}

// ==========================================
// HOME COMPONENT
// ==========================================
function Home({ session, setAuthOpen, styleVersion }: { session: Session | null; setAuthOpen: (v: boolean) => void; styleVersion: string }) {
  const theme = getTheme(styleVersion);
  const [contactOpen, setContactOpen] = useState(false);
  const [faqOpen, setFaqOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [, setLocation] = useLocation();
  const [sent, setSent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedArtist, setSelectedArtist] = useState<Artist | null>(null);
  const [visibleCount, setVisibleCount] = useState(9);

  const [isHeaderHidden, setIsHeaderHidden] = useState(false);
  const lastScrollY = useRef(0);
  const { scrollY } = useScroll();

  useMotionValueEvent(scrollY, "change", (latest) => {
    const previous = lastScrollY.current;
    if (latest > previous && latest > 80) {
      setIsHeaderHidden(true);
    } else {
      setIsHeaderHidden(false);
    }
    lastScrollY.current = latest;
  });

  const [platformStats, setPlatformStats] = useState({
    avgBookingValue: 21700,
    totalBookings: 1250,
    avgRating: 4.8
  });

  const handleSelectArtist = (artist: Artist) => {
    if ((artist as any).isLiveDb || String(artist.id).includes('-')) {
      setLocation(`/artist/${artist.id}?style=${styleVersion}`);
    } else {
      setSelectedArtist(artist);
    }
  };

  const editorialImages = [
    '1522337360788-8b13fee7a3af', '1515377905703-c4788e51af15', '1508186225823-0963cfdbaa18',
    '1509967419530-da38b4704bc6', '1542452255199-3172cb8cbce8', '1518049362265-d5b2a6467637'
  ];

  const { data: liveArtists = [] } = useQuery({
    queryKey: ['liveArtists'],
    queryFn: async () => {
      // REPLACE WITH THIS:
const { data: profiles, error: profileError } = await supabase
  .from('artist_profiles')
  .select(`id, business_name, category, city, area, max_travel_km, starting_price, avatar_url`);

      if (profileError) {
        console.error('Error fetching live artists:', profileError.message);
        return [];
      }

      if (!profiles) return [];

      const { data: allPortfolios } = await supabase
        .from('artist_portfolio')
        .select('artist_id, image_url, tags, created_at')
        .order('created_at', { ascending: false });

      const portfolioMap = new Map<string, Array<{ url: string; tags: string[] }>>();
      const artistTagMap = new Map<string, string[]>();

      if (allPortfolios) {
        allPortfolios.forEach((p: any) => {
          const rowTags: string[] = Array.isArray(p.tags) ? p.tags : [];

          if (!portfolioMap.has(p.artist_id)) {
            portfolioMap.set(p.artist_id, []);
          }
          portfolioMap.get(p.artist_id)?.push({ url: p.image_url, tags: rowTags });

          if (!artistTagMap.has(p.artist_id)) {
            artistTagMap.set(p.artist_id, []);
          }
          if (rowTags.length > 0) {
            artistTagMap.get(p.artist_id)?.push(...rowTags);
          }
        });
      }

      return profiles.map((item: any, index: number) => {
        const rawPort = portfolioMap.get(item.id) || [];
        const artistTags = Array.from(new Set(artistTagMap.get(item.id) || []));

        const normalizedPortfolio = rawPort.map((entry, i) => {
          const filename = entry.url.split('/').pop();
          const { data } = supabase.storage
            .from('portfolios')
            .getPublicUrl(`portfolios/${item.id}/${filename}`);
          return {
            style: `look n°${String(i + 1).padStart(2, '0')}`,
            image: data.publicUrl,
            tags: legacyTagsToStructured(entry.tags),
            rawTags: entry.tags
          };
        });

        const fallbackImage = `https://images.unsplash.com/photo-${editorialImages[index % editorialImages.length]}?auto=format&fit=crop&w=1200&q=80`;
        const mainImage = item.avatar_url || normalizedPortfolio[0]?.image || fallbackImage;
        const hoverImage = normalizedPortfolio[1]?.image || mainImage;
//////////
        return {
          id: item.id,
          name: item.business_name || 'Artist Studio',
          category: item.category || 'Bridal & Wedding',
          services: ['Makeup Artist', item.category || 'Bridal & Wedding'],
          city: item.city || '',
          location: item.area && item.city ? `${item.area}, ${item.city}` : (item.city || item.area || ''),
          maxTravelKm: item.max_travel_km || 25,
          pricePerSession: item.starting_price || 15000,
          startingPrice: `₹${(item.starting_price || 15000).toLocaleString('en-IN')}`,
          rating: 4.9,
          reviewCount: 24 + (index % 40),
          reviewsCount: 24 + (index % 40),
          image: mainImage,
          hoverImage: hoverImage,
          tags: artistTags.length > 0 ? artistTags.slice(0, 4) : [item.category || 'Bridal', 'HD Airbrush', 'Custom Styling'],
          allTags: artistTags,
          ai_tags: legacyTagsToStructured(artistTags.length > 0 ? artistTags : [item.category || 'Bridal']),
          bio: `${item.business_name || 'This artist'} specializes in ${(item.category || 'bridal & wedding').toLowerCase()} looks, tailored to high-end events in ${item.city || 'India'}.`,
          signature: `${item.category || 'Signature Aesthetic'}`,
          portfolio: normalizedPortfolio.length > 0 ? normalizedPortfolio : [{ style: 'signature work', image: fallbackImage }],
          addons: [],
          isVerified: true,
          isLiveDb: true,
          isIncompleteProfile: !item.business_name || normalizedPortfolio.length === 0,
        } as Artist & { isLiveDb?: boolean; isIncompleteProfile?: boolean; matchScore?: number };
      });
    },
    staleTime: 0,
  });

  const [sortBy, setSortBy] = useState('Best match');
  const [budgetCap, setBudgetCap] = useState<number | null>(null);
  const [cityFilters, setCityFilters] = useState<Record<string, boolean>>({});
  const [citySearch, setCitySearch] = useState('');

  useEffect(() => {
    async function fetchStats() {
      try {
        const { data: artists } = await supabase.from('artist_profiles').select('starting_price');
        let avgPrice = 21700;
        if (artists && artists.length > 0) {
          const validPrices = artists.map((a: any) => a.starting_price).filter((p: number) => p > 0);
          if (validPrices.length > 0) {
            avgPrice = Math.round(validPrices.reduce((a, b) => a + b, 0) / validPrices.length);
          }
        }
        const { count: bookingCount } = await supabase
          .from('bookings')
          .select('*', { count: 'exact', head: true })
          .in('status', ['paid', 'confirmed', 'completed', 'successful']);
        setPlatformStats(prev => ({
          ...prev,
          avgBookingValue: avgPrice || prev.avgBookingValue,
          totalBookings: (bookingCount || 0) + 1250,
        }));
      } catch (error) {
        console.error("Could not fetch live stats:", error);
      }
    }
    fetchStats();
  }, []);

  const [search, setSearch] = useState<HeroSearchValue>({
    services: ['Makeup Artist'],
    location: 'India',
    date: 'this weekend',
    timeSlot: 'Morning (08:00 - 13:00)',
    priceRange: 'Any Investment',
    lookDescription: '',
    inspirationFile: null
  });

  const sourceArtists: Artist[] = useMemo(() => {
    return liveArtists;
  }, [liveArtists]);

  const {
    phase,
    analysis,
    error: matchError,
    matchedById,
    submitReference,
    clearReference,
    setReferenceTags,
  } = useReferenceMatching(sourceArtists);

  const handleSearchChange = async (newVal: HeroSearchValue) => {
    if (newVal.inspirationFile && !session) {
      window.alert("Please Sign In or Create an Account to use AI Vision Look Matching.");
      setAuthOpen(true);
      return;
    }

    setSearch(newVal);

    if (newVal.inspirationFile) {
      submitReference(newVal.inspirationFile);
    } else {
      clearReference();
    }
  };

  const [hasSearched, setHasSearched] = useState(false);
  const [briefOpen, setBriefOpen] = useState(false);
  const openBrief = () => { setSent(false); setBriefOpen(true); };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.alert("You have been signed out.");
  };

  const [menuOpen, setMenuOpen] = useState(false);
  const [discoverOpen, setDiscoverOpen] = useState(false);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('all');

  const base = runCanvasMatch(
    search.services,
    search.location,
    selectedCategoryFilter,
    [],
    sourceArtists
  );

  type MatchedArtist = Artist & {
    match?: number;
    matchScore?: number;
    matchChips?: string[];
    matchReasons?: string[];
  };

  const matchedArtists: MatchedArtist[] = !matchedById
    ? base
    : base
        .map((a): MatchedArtist => {
          const r = matchedById.get(String(a.id));
          return r
            ? { ...a, match: r.score, matchChips: r.chips, matchReasons: r.chips }
            : a;
        })
        .sort((a, b) => (b.match ?? 0) - (a.match ?? 0) || b.rating - a.rating);

  // Budget slider follows the real artist prices instead of a fixed 65,000.
  // budgetCap === null means "no limit", so the slider stays at the top and
  // grows automatically when an artist with a higher fee appears.
  const BUDGET_STEP = 1000;
  const highestArtistPrice = matchedArtists.reduce(
    (max, a) => Math.max(max, Number(a.pricePerSession) || 0),
    0
  );
  const priceCeiling =
    highestArtistPrice > 0 ? Math.ceil(highestArtistPrice / BUDGET_STEP) * BUDGET_STEP : 65000;
  const priceFloor = Math.max(0, Math.min(5000, priceCeiling - BUDGET_STEP));
  const maxBudget =
    budgetCap === null ? priceCeiling : Math.min(Math.max(budgetCap, priceFloor), priceCeiling);

  const filteredArtists = matchedArtists.filter(artist => {
    if (artist.pricePerSession > maxBudget) return false;

    const activeCities = Object.entries(cityFilters)
      .filter(([_, isChecked]) => isChecked)
      .map(([city]) => city.toLowerCase());

    if (activeCities.length > 0) {
      const matchesCity = activeCities.some(ac => {
        const parts = ac.split('/').map(p => p.trim());
        return parts.some(part => {
          const aCity = (artist.city || '').toLowerCase();
          const aLoc = (artist.location || '').toLowerCase();
          return aCity.includes(part) || part.includes(aCity) || aLoc.includes(part) || part.includes(aLoc);
        });
      });
      if (!matchesCity) return false;
    }

    return true;
  }).sort((a, b) => {
    if (sortBy === 'Highest rated') return b.rating - a.rating;
    if (sortBy === 'Price: low to high') return a.pricePerSession - b.pricePerSession;
    if (sortBy === 'Price: high to low') return b.pricePerSession - a.pricePerSession;
    return (b.match ?? 0) - (a.match ?? 0);
  });

  const uniqueArtists: MatchedArtist[] = Array.from(
    new Map<string, MatchedArtist>(filteredArtists.map((item) => [item.id, item])).values()
  );

  useEffect(() => {
    if (!discoverOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setDiscoverOpen(false); };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [discoverOpen]);

  const prefersReducedMotion = useReducedMotion();

  const [, setBgY] = useState(0);
  useEffect(() => {
    return scrollY.onChange((latest) => {
      setBgY(prefersReducedMotion ? 0 : Math.min(latest * BG_PARALLAX_FACTOR, BG_PARALLAX_MAX_PX));
    });
  }, [scrollY, prefersReducedMotion]);

  const scrollTo = (id: string) => {
    setMenuOpen(false);
    setDiscoverOpen(false);
    setSelectedArtist(null);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleBriefSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!session) {
      window.alert("Please Sign In or Create an Account to secure a booking.");
      setBriefOpen(false);
      setAuthOpen(true);
      return;
    }
    if (!selectedArtist?.id || !(selectedArtist as any).isLiveDb) {
      window.alert("This artist is a demo profile and isn't available for live bookings yet. Please choose a registered Canvas artist.");
      return;
    }
    setIsSubmitting(true);
    const formData = event.currentTarget;
    try {
      const dataElements = new FormData(formData);
      const bookingData = {
        client_id: session.user.id,
        artist_id: selectedArtist.id,
        service_name: selectedArtist.category || 'Bridal & Event Makeup',
        total_amount: selectedArtist.pricePerSession || 15000,
        event_date: dataElements.get('date'),
        time_slot: dataElements.get('slot'),
        venue_address: dataElements.get('location'),
        look_details: dataElements.get('message'),
        status: 'pending_quote'
      };
      const { error } = await supabase.from('bookings').insert([bookingData]);
      if (error) throw error;
      setSent(true);
    } catch (error: any) {
      console.error("Error sending booking:", error);
      window.alert(`Booking failed: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={`relative min-h-[100dvh] overflow-x-hidden text-[var(--canvas-dp)] bg-[#FDF3F1] ${theme.fontBase}`}>
      <motion.nav
        animate={{ y: (isChatOpen || isHeaderHidden) ? -120 : 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="fixed top-0 left-0 right-0 z-[200] grid grid-cols-3 items-center px-4 sm:px-6 md:px-12 h-[100px] bg-[#FDF3F1]/90 backdrop-blur-md border-b border-black/5"
      >
        <div className="hidden md:flex items-center gap-8 justify-start">
          <a onClick={() => scrollTo('discover')} className={`${theme.navLink} cursor-pointer`}>directory</a>
          <a onClick={() => scrollTo('standard')} className={`${theme.navLink} cursor-pointer`}>the standard</a>
        </div>
        <div className="flex items-center justify-center cursor-pointer group" onClick={() => scrollTo('top')}>
          <div className="flex items-center gap-2.5">
            <img src="/logo.png" alt="Canvas Logo" className="w-10 h-10 md:w-12 md:h-12 object-contain transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-110 group-hover:-rotate-3 group-hover:drop-shadow-[0_4px_12px_rgba(107,58,125,0.3)]" />
            <span className={`${theme.headingSection} !text-2xl md:!text-3xl tracking-tight transition-colors duration-500 uppercase font-bold !text-[#9D7C3A]`}>CANVAS</span>
          </div>
        </div>
        <div className="flex items-center gap-6 justify-end">
          {session ? (
            <>
              <button onClick={() => setLocation(`/dashboard?style=${styleVersion}`)} className={`${theme.navLink} hidden sm:block`}>dashboard</button>
              <button onClick={handleSignOut} className={`${theme.navLink} hidden sm:block`}>sign out</button>
            </>
          ) : (
            <button onClick={() => setAuthOpen(true)} className={`hidden sm:block ${theme.navLink}`}>account</button>
          )}
          <button type="button" onClick={() => setMenuOpen(!menuOpen)} className="p-2 text-black md:hidden">{menuOpen ? <X size={24} /> : <Menu size={24} />}</button>
        </div>
      </motion.nav>

      <AnimatePresence>
        {menuOpen && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className={`fixed top-[100px] left-0 right-0 z-[190] bg-[#FDF3F1] border-b ${theme.borderBase} p-6 flex flex-col gap-4 shadow-lg md:hidden`}>
            {session && <a onClick={() => { setLocation(`/dashboard?style=${styleVersion}`); setMenuOpen(false); }} className={`${theme.navLink} border-b ${theme.borderBase} pb-3`}>dashboard</a>}
            <a onClick={() => { scrollTo('top'); setMenuOpen(false); }} className={theme.navLink}>home</a>
            <a onClick={() => { scrollTo('discover'); setMenuOpen(false); }} className={theme.navLink}>browse artists</a>
            <a onClick={() => { scrollTo('standard'); setMenuOpen(false); }} className={theme.navLink}>for artists</a>
            {!session && <a onClick={() => { setAuthOpen(true); setMenuOpen(false); }} className={`${theme.navLink} border-t ${theme.borderBase} pt-3`}>my account</a>}
          </motion.div>
        )}
      </AnimatePresence>

      <section id="top" className="grid md:grid-cols-2 md:min-h-screen gap-8 pt-[100px] pb-14 md:pb-20 px-4 sm:px-8 md:px-12 lg:px-20 bg-[radial-gradient(ellipse_60%_50%_at_85%_15%,rgba(201,164,99,0.07),transparent_60%)] relative">
        <ScrollZoomIn>
          <div className="flex flex-col justify-center py-12 md:py-20 md:pr-10 z-10 animate-rise-in">
            <div className="flex flex-col items-start pt-4 mb-8">
              <div className="flex items-center gap-3 font-['Montserrat'] text-[11px] font-bold uppercase tracking-[0.2em] text-[#9D7C3A] mb-6">
                <div className="w-[26px] h-[1px] bg-[#9D7C3A]"></div>
                ai-powered beauty matching
              </div>

              <h1 className="flex flex-col items-start text-black select-none mb-6 w-full">
  {/* 1. "India's" - Locked in with the exact font she explicitly asked to keep */}
  <span className="font-india font-normal text-[3.5rem] sm:text-[5.5rem] md:text-[7.5rem] tracking-[0.02em] leading-[1] text-[#3B1E54] -mb-2 md:-mb-6">
    India's
  </span>
  
  <span className="font-['PinyonScript',cursive] bg-gradient-to-r from-[#7A5C24] via-[#E2BE68] to-[#7A5C24] text-transparent bg-clip-text inline-block text-[4.5rem] sm:text-[7rem] md:text-[8.5rem] leading-[1.1] py-2 md:py-4 relative z-10 drop-shadow-sm pr-4">
    Premium
  </span>
  
{/* 3. "Beauty Match." - Replaced the coded text with her exact image */}
  <div className="w-[85%] sm:w-[75%] md:w-[65%] mt-2 md:mt-4 flex justify-center z-0">
    <img 
      src="/beauty-match-text.jpg" 
      alt="Beauty Match" 
      className="w-full h-auto object-contain"
    />
  </div>
</h1>
////////////////////////////////////////
            </div>

            <p className={`${theme.bodyText} !font-normal !text-[#3B1E54]/75 max-w-[460px] mb-3`}>upload the look that inspires you - a screenshot, a saved post, anything - and our AI reads the style, mood, and technique to find artists whose work genuinely matches.</p>
            <p className={`${theme.bodyText} !font-normal !text-[#3B1E54]/75 max-w-[560px] text-pretty mb-8`}>the exclusive ai-powered bridal and beauty booking platform for india.</p>
            <div className="flex gap-4 flex-wrap">
              <button onClick={() => scrollTo('demo-search')} className={`w-full sm:w-auto text-center ${theme.btnPrimary}`}>try the live demo →</button>
            </div>
          </div>
        </ScrollZoomIn>

        <ScrollZoom>
          <div className="flex flex-col items-center justify-center py-8 md:py-16 relative">
            <CanvasVisualEditorial theme={theme} />
          </div>
        </ScrollZoom>
      </section>

      <section id="demo-search" className="relative z-20 bg-[#FDF3F1] py-24 border-b border-black/5">
        <ScrollZoomIn>
          <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-8 lg:px-12">
            <HeroSearch
  value={search}
  onChange={handleSearchChange}
  onSubmit={async (vals) => {
    setSearch(vals);
    setHasSearched(true);
    
    if (vals.inspirationFile) {
      submitReference(vals.inspirationFile);
    } else if (vals.lookDescription && vals.lookDescription.trim().length > 3) {
      console.log("Extracting tags for description:", vals.lookDescription);
      const extractedTags = await extractTagsFromText(vals.lookDescription);
      console.log("Extracted Tags Result:", extractedTags);
      
      if (setReferenceTags) {
        setReferenceTags(extractedTags);
      }
    } else {
      clearReference();
    }
    
    scrollTo('discover');
  }}
  isAuthenticated={!!session}
  onAuthRequired={() => setAuthOpen(true)}
/>
          </div>
        </ScrollZoomIn>
      </section>

      <main className="relative z-20">
        <ScrollZoomIn className="stats-bar w-full">
          <div className="grid w-full grid-cols-2 items-center gap-y-10 gap-x-4 px-4 py-10 sm:grid-cols-4 sm:gap-x-0 sm:px-8 lg:px-12">
            <div className="stat flex flex-col items-center justify-center text-center px-2 sm:px-6 border-black/10 sm:border-l sm:first:border-l-0">
              <ScrollZoom><div className={theme.stat}>{sourceArtists.length}</div></ScrollZoom>
              <ScrollZoomIn delay={100}>
                <div className={`${theme.eyebrow} !text-black/80`}>{toTitleCase('verified artists')}</div>
              </ScrollZoomIn>
            </div>
            <div className="stat flex flex-col items-center justify-center text-center px-2 sm:px-6 border-black/10 sm:border-l sm:first:border-l-0">
              <ScrollZoom><div className={theme.stat}>₹{platformStats.avgBookingValue.toLocaleString('en-IN')}</div></ScrollZoom>
              <ScrollZoomIn delay={100}>
                <div className={`${theme.eyebrow} !text-black/80`}>{toTitleCase('avg booking value')}</div>
              </ScrollZoomIn>
            </div>
            <div className="stat flex flex-col items-center justify-center text-center px-2 sm:px-6 border-black/10 sm:border-l sm:first:border-l-0">
              <ScrollZoom><div className={theme.stat}>100%</div></ScrollZoom>
              <ScrollZoomIn delay={100}>
                <div className={`${theme.eyebrow} !text-black/80`}>{toTitleCase('client satisfaction')}</div>
              </ScrollZoomIn>
            </div>
            <div className="stat flex flex-col items-center justify-center text-center px-2 sm:px-6 border-black/10 sm:border-l sm:first:border-l-0">
              <ScrollZoom><div className={theme.stat}>{platformStats.avgRating}★</div></ScrollZoom>
              <ScrollZoomIn delay={100}>
                <div className={`${theme.eyebrow} !text-black/80`}>{toTitleCase('platform avg rating')}</div>
              </ScrollZoomIn>
            </div>
          </div>
        </ScrollZoomIn>

        <section id="discover" className="bg-[#FDF3F1] text-black py-24 sm:py-32">
          <div className="mx-auto max-w-[1400px] px-5 sm:px-8 lg:px-12">
            <ScrollZoomIn>
              <div className="mb-12 flex flex-col gap-5">
                <div>
                  <p className={`${theme.eyebrow} mb-3`}>{toTitleCase('the shortlist')}</p>
                  <h2 className={theme.headingSection}>{toTitleCase('meet the')} <span className={theme.premiumTag}>{toTitleCase('artists')}</span></h2>
                </div>
                <p className={`${theme.bodyText} max-w-[500px]`}>a private directory of india&apos;s most sought-after talent, rigorously vetted for their technical execution and distinct aesthetic vision.</p>
              </div>
            </ScrollZoomIn>

            <ScrollZoomIn>
              <div className={`-mx-5 px-5 sm:mx-0 sm:px-0 mb-12 flex gap-3 overflow-x-auto sm:flex-wrap sm:overflow-visible border-b ${theme.borderBase} pb-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`}>
                {discoverCategories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategoryFilter(cat.id)}
                    className={`shrink-0 whitespace-nowrap px-6 py-3 transition-colors border ${theme.cardRadius} ${theme.formLabel} ${selectedCategoryFilter === cat.id ? 'border-black bg-black text-white' : `${theme.borderBase} bg-transparent text-black/60 hover:border-black hover:text-black`}`}
                  >
                    {toTitleCase(cat.label)}
                  </button>
                ))}
              </div>
            </ScrollZoomIn>

{hasSearched && (search.inspirationFile || search.lookDescription) && (
  <ScrollZoomIn>
    <div className="mb-12 mt-8">
      <AIMatchPanel
        phase={phase}
        analysis={analysis}
        error={matchError}
        onClear={clearReference}
      />
    </div>
  </ScrollZoomIn>
)}

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-12 items-start mt-10">
              <ScrollZoomIn className={`lg:col-span-1 bg-white/40 backdrop-blur-md border ${theme.borderBase} p-6 space-y-8 lg:sticky lg:top-8 ${theme.cardRadius}`}>
                <div>
                  <label className={`block mb-3 ${theme.formLabel}`}>sort by</label>
                  <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className={`w-full bg-transparent border-b ${theme.borderBase} p-3 ${theme.inputText} cursor-pointer`}>
                    <option value="Best match">best match</option>
                    <option value="Highest rated">highest rated</option>
                    <option value="Price: low to high">price: low to high</option>
                    <option value="Price: high to low">price: high to low</option>
                  </select>
                </div>
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <label className={theme.formLabel}>max budget</label>
                    <span className={`${theme.formLabel} bg-gradient-to-r from-[#7A5C24] via-[#E2BE68] to-[#7A5C24] text-transparent bg-clip-text inline-block`}>₹{maxBudget.toLocaleString('en-IN')}</span>
                  </div>
                  <input
                    type="range"
                    min={priceFloor}
                    max={priceCeiling}
                    step={BUDGET_STEP}
                    value={maxBudget}
                    onChange={(e) => {
                      const value = Number(e.target.value);
                      setBudgetCap(value >= priceCeiling ? null : value);
                    }}
                    className="w-full accent-[#9D7C3A] cursor-pointer"
                  />
                  <p className={`${theme.formLabel} mt-1`}>up to ₹{maxBudget.toLocaleString('en-IN')}</p>
                </div>
                
                <div className="mb-10">
                  <h3 className={`mb-5 ${theme.formLabel}`}>{toTitleCase('city')}</h3>
                  <input 
                    type="text" 
                    placeholder="Search 496 cities..." 
                    value={citySearch}
                    onChange={(e) => setCitySearch(e.target.value)}
                    className={`w-full mb-4 p-2.5 bg-transparent border-b ${theme.borderBase} focus:outline-none focus:border-black ${theme.inputText}`}
                  />
                  <div className="max-h-64 overflow-y-auto pr-2 custom-scrollbar space-y-3">
                    {INDIAN_CITIES.filter(city => city.toLowerCase().includes(citySearch.toLowerCase())).map((city) => (
                      <label key={city} className="flex cursor-pointer items-center group">
                        <div
                          onClick={() => setCityFilters(prev => ({ ...prev, [city]: !prev[city] }))}
                          className={`mr-4 flex h-[18px] w-[18px] items-center justify-center rounded-[4px] border ${cityFilters[city] ? 'border-[#9D7C3A] bg-[#9D7C3A]' : 'border-black/20 group-hover:border-[#9D7C3A]'} transition-colors`}
                        >
                          {cityFilters[city] && (
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                          )}
                        </div>
                        <span
                          onClick={() => setCityFilters(prev => ({ ...prev, [city]: !prev[city] }))}
                          className={`${theme.formLabel} ${cityFilters[city] ? '!text-black' : '!text-black/50'} transition-colors`}
                        >
                          {city.toLowerCase()}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

              </ScrollZoomIn>

              <div className="lg:col-span-3">
                <ScrollZoomIn>
                  <p className={`${theme.formLabel} mb-6`}>showing {uniqueArtists.length} of {sourceArtists.length} artists</p>
                </ScrollZoomIn>

                <div>
                  {uniqueArtists.length > 0 ? (
                    <>
                      <div className="grid gap-x-6 gap-y-16 md:grid-cols-2 lg:grid-cols-3">
                        {uniqueArtists.slice(0, visibleCount).map((artist, index) => (
                          <ScrollZoom key={artist.id || index} delay={index * 80}>
                            <ArtistCard
  name={artist.name}
  image={artist.image}
  hoverImage={artist.hoverImage}
  portfolioImages={artist.portfolio?.map((p: any) => typeof p === 'string' ? p : p?.image).filter(Boolean)}
  startingPrice={artist.startingPrice}
  tags={artist.tags}
  matchPercentage={(search.inspirationFile || search.lookDescription) ? artist.match : undefined}
  matchReasons={artist.matchReasons}
  onClick={() => handleSelectArtist(artist)}
/>
                          </ScrollZoom>
                        ))}
                      </div>
                      {visibleCount < uniqueArtists.length && (
                        <ScrollZoomIn>
                          <div className="mt-16 flex justify-center">
                            <button type="button" onClick={() => setVisibleCount(prev => prev + 9)} className={theme.btnOutline}>load more artists</button>
                          </div>
                        </ScrollZoomIn>
                      )}
                    </>
                  ) : (
                    <ScrollZoomIn>
                      <div className={`flex min-h-[300px] flex-col items-center justify-center border ${theme.borderBase} bg-white px-6 text-center shadow-sm ${theme.cardRadius}`}>
                        <p className={theme.headingModal}>{toTitleCase('no artists found')}</p>
                        <p className={`mt-4 max-w-sm ${theme.bodyText}`}>adjust your budget or city filters</p>
                        <button
                          type="button"
                          onClick={() => {
                            setBudgetCap(null);
                            setCityFilters({});
                            setVisibleCount(9);
                          }}
                          className={`mt-8 ${theme.btnPrimary}`}
                        >
                          reset filters
                        </button>
                      </div>
                    </ScrollZoomIn>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="standard" className="bg-[#F9EBE8] text-black py-24 sm:py-32 border-t border-black/5">
          <div className="mx-auto max-w-[1400px] px-5 sm:px-8 lg:px-12">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-20 items-end mb-24">
              <ScrollZoomIn className="lg:col-span-8">
                <p className={`${theme.eyebrow} mb-8`}>{toTitleCase('the canvas standard')}</p>
                <h2 className={theme.headingHero}>{toTitleCase('beauty is a')} <span className={theme.premiumTag}>{toTitleCase('point of view.')}</span></h2>
              </ScrollZoomIn>
              <ScrollZoomIn className="lg:col-span-4 pb-3" delay={150}>
                <p className={theme.bodyText}>canvas is a private directory, not an open marketplace. every artist on this platform has been rigorously vetted for their technical execution, kit hygiene, and distinct aesthetic vision.</p>
              </ScrollZoomIn>
            </div>
            <div className={`grid gap-12 border-t ${theme.borderBase} pt-12 sm:grid-cols-3`}>
              <ScrollZoomIn delay={0}>
                <div className="group cursor-default">
                  <div className="flex items-center justify-between mb-8">
                    <h3 className={theme.eyebrow}>{toTitleCase('curated talent')}</h3>
                    <p className={`${theme.stat} !text-black/20 transition-colors group-hover:!text-[#9D7C3A]`}>01</p>
                  </div>
                  <p className={theme.bodyText}><strong className="text-black font-bold">distinct hand, not a uniform finish.</strong> we reject cookie-cutter application, selecting artists exclusively for their unique ability to elevate natural features.</p>
                </div>
              </ScrollZoomIn>
              <ScrollZoomIn delay={120}>
                <div className="group cursor-default">
                  <div className="flex items-center justify-between mb-8">
                    <h3 className={theme.eyebrow}>{toTitleCase('the experience')}</h3>
                    <p className={`${theme.stat} !text-black/20 transition-colors group-hover:!text-[#9D7C3A]`}>02</p>
                  </div>
                  <p className={theme.bodyText}><strong className="text-black font-bold">care in the details and generosity.</strong> from high-end skin prep to impeccable kit hygiene, our standard for client comfort is non-negotiable.</p>
                </div>
              </ScrollZoomIn>
              <ScrollZoomIn delay={240}>
                <div className="group cursor-default">
                  <div className="flex items-center justify-between mb-8">
                    <h3 className={theme.eyebrow}>{toTitleCase('private network')}</h3>
                    <p className={`${theme.stat} !text-black/20 transition-colors group-hover:!text-[#9D7C3A]`}>03</p>
                  </div>
                  <p className={theme.bodyText}><strong className="text-black font-bold">the list is small so it means something.</strong> we prioritize strict quality over volume, eliminating the guesswork of endless scrolling.</p>
                </div>
              </ScrollZoomIn>
            </div>
          </div>
        </section>

        <section className="testimonials py-24 bg-[#FDF3F1]">
          <div className="max-w-[1400px] mx-auto px-5 sm:px-8 lg:px-12">
            <ScrollZoom>
              <div className={`flex items-center justify-center gap-3 ${theme.eyebrow} mb-3`}><span className="h-[1px] w-12 bg-black/10"></span>{toTitleCase('love from our users')}<span className="h-[1px] w-12 bg-black/10"></span></div>
              <h2 className={`${theme.headingSection} text-center mb-16`}>{toTitleCase('what people are saying')}</h2>
            </ScrollZoom>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <ScrollZoomIn delay={0}>
                <div className={`bg-white/60 p-8 border ${theme.borderBase} ${theme.cardRadius} flex flex-col justify-between`}>
                  <div className="mb-4 bg-gradient-to-r from-[#7A5C24] via-[#E2BE68] to-[#7A5C24] text-transparent bg-clip-text inline-block">★★★★★</div>
                  <p className={`${theme.quote} mb-6`}>&quot;I uploaded a picture from Pinterest and Canvas found me an artist who had done almost the exact same look. Honestly shocked at how accurate the match was.&quot;</p>
                  <div className={`flex items-center gap-3 pt-4 border-t ${theme.borderBase}`}>
                    <div className="w-10 h-10 rounded-full bg-[#E8D5F2] text-[#2D1B4E] flex items-center justify-center font-bold text-xs">SR</div>
                    <div><div className={theme.formLabel}>sneha r.</div><div className={`${theme.formLabel} !text-black/40`}>bridal • delhi</div></div>
                  </div>
                </div>
              </ScrollZoomIn>
              <ScrollZoomIn delay={120}>
                <div className={`bg-white/60 p-8 border ${theme.borderBase} ${theme.cardRadius} flex flex-col justify-between`}>
                  <div className="mb-4 bg-gradient-to-r from-[#7A5C24] via-[#E2BE68] to-[#7A5C24] text-transparent bg-clip-text inline-block">★★★★★</div>
                  <p className={`${theme.quote} mb-6`}>&quot;As a model, finding artists who understand editorial work is hard. Canvas filtered out the noise immediately. The match score is genuinely useful.&quot;</p>
                  <div className={`flex items-center gap-3 pt-4 border-t ${theme.borderBase}`}>
                    <div className="w-10 h-10 rounded-full bg-[#1A0B2E] text-[#C4A35A] flex items-center justify-center font-bold text-xs">KM</div>
                    <div><div className={theme.formLabel}>kavya m.</div><div className={`${theme.formLabel} !text-black/40`}>editorial • mumbai</div></div>
                  </div>
                </div>
              </ScrollZoomIn>
              <ScrollZoomIn delay={240}>
                <div className={`bg-white/60 p-8 border ${theme.borderBase} ${theme.cardRadius} flex flex-col justify-between`}>
                  <div className="mb-4 bg-gradient-to-r from-[#7A5C24] via-[#E2BE68] to-[#7A5C24] text-transparent bg-clip-text inline-block">★★★★★</div>
                  <p className={`${theme.quote} mb-6`}>&quot;Described the look in two lines, got artists who could do it sorted by price. Booked in ten minutes. This is exactly how it should work.&quot;</p>
                  <div className={`flex items-center gap-3 pt-4 border-t ${theme.borderBase}`}>
                    <div className="w-10 h-10 rounded-full bg-[#F5E6C8] text-[#2D1B4E] flex items-center justify-center font-bold text-xs">TP</div>
                    <div><div className={theme.formLabel}>tara p.</div><div className={`${theme.formLabel} !text-black/40`}>glam • bengaluru</div></div>
                  </div>
                </div>
              </ScrollZoomIn>
            </div>
          </div>
        </section>

        <ScrollZoomIn>
          <section className="bg-[#150A26] py-24 sm:py-32 px-5 border-t border-white/10 text-center">
            <div className="max-w-[800px] mx-auto">
              <div className={`flex items-center justify-center gap-3 ${theme.eyebrow} !text-[#9D7C3A] mb-3`}><span className="h-[1px] w-12 bg-[#9D7C3A]"></span>{toTitleCase('for makeup artists')}<span className="h-[1px] w-12 bg-[#9D7C3A]"></span></div>
              <h2 className={`${theme.headingHero} !text-white mb-8`}>{toTitleCase('are you a makeup artist?')}</h2>
              <p className={`${theme.bodyText} !text-white/70 mb-12 max-w-[680px] mx-auto`}>it is completely free to list your verified portfolio on canvas. when our ai matches you with a bride, you will receive a blurred notification. to unlock the client&apos;s whatsapp number and inspiration photo (a high-intent lead), you simply pay a micro-fee of ₹99. you can also upgrade to canvas pro for a flat monthly subscription to unlock unlimited leads and priority placement in our ai search results.</p>
              <div className="flex flex-col sm:flex-row justify-center gap-4">
                <button
                  onClick={() => window.alert('Canvas Pro features are launching soon! Create a free account today to get early access.')}
                  className={`${theme.btnOutline} !border-[#9D7C3A] !text-[#9D7C3A] hover:!bg-[#9D7C3A] hover:!text-white`}
                >
                  explore pro features
                </button>
                <button onClick={() => setAuthOpen(true)} className={theme.btnPrimary}>
                  apply to join canvas
                </button>
              </div>
            </div>
          </section>
        </ScrollZoomIn>

        <JournalSectionSessionWrapper session={session} setAuthOpen={setAuthOpen} theme={theme} />

        <ScrollZoomIn>
          <footer className={`bg-[#05020A] text-white px-5 py-16 sm:px-8 lg:px-12 border-t border-white/10 ${theme.fontBase}`}>
            <div className="mx-auto max-w-[1400px] grid gap-12 lg:grid-cols-4 lg:gap-8">
              <div className="lg:col-span-1">
                <h3 className={`${theme.formLabel} !text-white mb-4`}>{toTitleCase('down for more? we got you!')}</h3>
                <p className={`${theme.bodyText} !text-white/50 mb-6 leading-relaxed`}>the latest artists, drops, in-store event info + more—straight to your inbox.</p>
                <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
                  <div className="relative border-b border-white/20 pb-2">
                    <input type="email" placeholder="email address" className={`w-full bg-transparent ${theme.inputText} !border-none !text-white`} />
                  </div>
                  <div className="relative border-b border-white/20 pb-2 mt-4">
                    <input type="tel" placeholder="phone number" className={`w-full bg-transparent ${theme.inputText} !border-none !text-white`} />
                  </div>
                </form>
              </div>

              <div className="lg:col-span-1 lg:pl-10">
  <h3 className={`${theme.formLabel} !text-white mb-6`}>{toTitleCase('Client Service')}</h3>
  <ul className={`space-y-3 ${theme.formLabel} !text-white/50`}>
    <li>
      <span className="block text-left text-white/50">Operating Hours Are From<br />9 AM - 9 PM EST Mon-Fri</span>
    </li>
    <li className="pt-4">
      <button type="button" onClick={() => setContactOpen(true)} className="hover:text-white transition-colors block text-left cursor-pointer">Contact Us</button>
    </li>
    <li>
      <button type="button" onClick={() => setFaqOpen(true)} className="hover:text-white transition-colors block text-left cursor-pointer">Help & FAQs</button>
    </li>
  </ul>
</div>

              <div className="lg:col-span-1">
                <h3 className={`${theme.formLabel} !text-white mb-6`}>{toTitleCase('about')}</h3>
                <ul className={`space-y-3 ${theme.formLabel} !text-white/50`}>
                  <li><a href="#about" className="hover:text-white transition-colors block">about the collective</a></li>
                  <li><a href="#standard" className="hover:text-white transition-colors block">the standard</a></li>
                  <li><a href="#careers" className="hover:text-white transition-colors block">careers</a></li>
                </ul>
              </div>

              <div className="lg:col-span-1 hidden lg:block">
                <ScrollZoom>
                  <div className={`h-full w-full bg-[#1A1A1A] border border-white/10 overflow-hidden ${theme.cardRadius}`}>
                    <img src="https://images.unsplash.com/photo-1596704017254-9b121068fb31?auto=format&fit=crop&w=800&q=80" alt="Canvas" onError={handleImgError} className="h-full w-full object-cover opacity-80 hover:opacity-100 transition-all duration-700" />
                  </div>
                </ScrollZoom>
              </div>
            </div>
          </footer>
        </ScrollZoomIn>
      </main>

      <ProfileModal open={Boolean(selectedArtist)} artist={selectedArtist} onClose={() => setSelectedArtist(null)} onBookAppointment={openBrief} onOpenChat={() => { setSelectedArtist(null); setIsChatOpen(true); }} />
      <ChatDrawer open={isChatOpen} onClose={() => setIsChatOpen(false)} />

      {briefOpen && (
        <div className={`fixed inset-0 z-[100] flex justify-end bg-black/60 backdrop-blur-sm ${theme.fontBase}`} role="presentation" onClick={() => setBriefOpen(false)}>
          <motion.aside initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }} className={`bg-white border-l border-black/10 h-full w-full max-w-xl overflow-auto p-8 sm:p-12 flex flex-col shadow-2xl`} role="dialog" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between border-b border-black/10 pb-8 mb-8">
              <div><p className={`${theme.eyebrow} mb-2`}>{toTitleCase(sent ? 'request secured' : 'private concierge')}</p><h2 className={theme.headingModal}>{toTitleCase(sent ? 'appointment locked.' : 'request a booking.')}</h2></div>
              <button type="button" onClick={() => setBriefOpen(false)} className="text-black/40 hover:text-black transition-colors"><X size={24} strokeWidth={1.5} /></button>
            </div>
            {sent ? (
              <div className="flex-1 flex flex-col justify-center mb-20 text-center">
                <div className="w-16 h-16 rounded-full bg-[#9D7C3A]/10 text-[#9D7C3A] flex items-center justify-center mx-auto mb-6"><Sparkles size={32} /></div>
                <h3 className={`${theme.headingModal} mb-4`}>{toTitleCase('the artist has been notified.')}</h3>
                <p className={`${theme.bodyText} mb-10 max-w-md mx-auto`}>your brief is securely in the artist&apos;s queue. you will receive a notification in your dashboard once they review the logistics and confirm the slot.</p>
                <button type="button" onClick={() => { setBriefOpen(false); setTimeout(() => setSelectedArtist(null), 200); }} className={`w-full ${theme.btnPrimary}`}>return to directory</button>
              </div>
            ) : (
              <div className="flex-1 flex flex-col">
                {selectedArtist && (
                  <div className={`flex items-center gap-4 bg-black/5 border border-black/10 p-4 mb-10 ${theme.cardRadius}`}>
                    <img src={selectedArtist.image} alt={selectedArtist.name} onError={handleImgError} className="w-12 h-12 object-cover rounded-full border border-black/10" />
                    <div><p className={theme.formLabel}>requesting availability for</p><p className={`${theme.headingModal} !text-base mt-0.5`}>{selectedArtist.name}</p></div>
                  </div>
                )}
                <form className="space-y-8 flex-1 flex flex-col" onSubmit={handleBriefSubmit}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                    <label className="block"><span className={theme.formLabel}>date required</span><input required type="date" name="date" className={`mt-3 w-full ${theme.inputText}`} /></label>
                    <label className="block"><span className={theme.formLabel}>preferred slot</span><select required name="slot" defaultValue="" className={`mt-3 w-full ${theme.inputText} [&>option]:bg-white`}><option value="" disabled>select phase...</option><option value="Early Morning (Before 8 AM)">slot 1: early morning (pre-8am)</option><option value="Morning (8 AM - 12 PM)">slot 2: morning prep (8am-12pm)</option><option value="Afternoon/Evening (12 PM - 8 PM)">slot 3: afternoon & evening</option><option value="Late Night (After 8 PM)">slot 4: late night (post-8pm)</option></select></label>
                  </div>
                  <label className="block"><span className={theme.formLabel}>exact venue / area</span><input required name="location" placeholder="e.g. taj falaknuma palace" className={`mt-3 w-full ${theme.inputText}`} /></label>
                  <label className="block flex-1"><span className={theme.formLabel}>the vision (look details)</span><textarea required name="message" placeholder="describe the aesthetic, outfit colors, or specific requirements..." rows={4} className={`mt-3 w-full resize-none ${theme.inputText}`} /></label>
                  <div className="pt-6 mt-auto">
                    <button type="submit" disabled={isSubmitting} className={`w-full ${theme.btnPrimary} disabled:opacity-50`}>{isSubmitting ? 'processing...' : 'submit concierge brief'}</button>
                    <p className={`text-center ${theme.formLabel} mt-4`}>your brief is securely transmitted to the artist.</p>
                  </div>
                </form>
              </div>
            )}
          </motion.aside>
        </div>
      )}

      {contactOpen && (
        <div className={`fixed inset-0 z-[100] flex justify-end bg-black/60 backdrop-blur-sm ${theme.fontBase}`} role="presentation" onClick={() => setContactOpen(false)}>
          <motion.aside initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }} className={`bg-white border-l border-black/10 h-full w-full max-w-xl overflow-auto p-8 sm:p-12 flex flex-col shadow-2xl`} role="dialog" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between border-b border-black/10 pb-8 mb-8">
              <div>
                <p className={`${theme.eyebrow} mb-2`}>{toTitleCase('Direct Support')}</p>
                <h2 className={theme.headingModal}>{toTitleCase('Contact Us.')}</h2>
              </div>
              <button type="button" onClick={() => setContactOpen(false)} className="text-black/40 hover:text-black transition-colors">
                <X size={24} strokeWidth={1.5} />
              </button>
            </div>
            <div className="space-y-6 text-black/80 flex-1">
              <p className={theme.bodyText}>We are here to assist with bookings, artist coordination, or custom requirements. Reach out directly through any channel below:</p>
              <div className="p-6 bg-black/5 rounded-lg border border-black/10 space-y-5">
                <div>
                  <p className={theme.formLabel}>Direct Phone / WhatsApp</p>
                  <a href="tel:+919848285649" className="text-lg font-medium text-black hover:text-[#6B3C9C] transition-colors mt-1 block">+91 98482 85649</a>
                </div>
                <div>
                  <p className={theme.formLabel}>Email Support</p>
                  <a href="mailto:thecanvasbeauty@gmail.com" className="text-lg font-medium text-black hover:text-[#6B3C9C] transition-colors mt-1 block">thecanvasbeauty@gmail.com</a>
                </div>
                <div>
                  <p className={theme.formLabel}>Operating Hours</p>
                  <p className="text-sm mt-1 text-black/70">9 AM - 9 PM EST (Mon - Fri)</p>
                </div>
              </div>
            </div>
          </motion.aside>
        </div>
      )}

      {faqOpen && (
        <div className={`fixed inset-0 z-[100] flex justify-end bg-black/60 backdrop-blur-sm ${theme.fontBase}`} role="presentation" onClick={() => setFaqOpen(false)}>
          <motion.aside initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }} className={`bg-white border-l border-black/10 h-full w-full max-w-xl overflow-auto p-8 sm:p-12 flex flex-col shadow-2xl`} role="dialog" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between border-b border-black/10 pb-8 mb-8">
              <div>
                <p className={`${theme.eyebrow} mb-2`}>{toTitleCase('Client Assistance')}</p>
                <h2 className={theme.headingModal}>{toTitleCase('Help & FAQs.')}</h2>
              </div>
              <button type="button" onClick={() => setFaqOpen(false)} className="text-black/40 hover:text-black transition-colors">
                <X size={24} strokeWidth={1.5} />
              </button>
            </div>
            <div className="space-y-6 text-black/80 flex-1">
              <div className="space-y-5">
                <div className="border-b border-black/10 pb-4">
                  <h4 className="font-medium text-black mb-1">{toTitleCase('How do I book a makeup artist?')}</h4>
                  <p className="text-sm text-black/70 leading-relaxed">Browse the directory, select your preferred artist, click &quot;Request Booking&quot;, fill in your event details, and submit your brief directly to their queue.</p>
                </div>
                <div className="border-b border-black/10 pb-4">
                  <h4 className="font-medium text-black mb-1">{toTitleCase('Can I chat with the artist before confirming?')}</h4>
                  <p className="text-sm text-black/70 leading-relaxed">Yes! Use the secure chat drawer available on artist profiles to discuss look details, timing, and specific venue requirements before locking in your date.</p>
                </div>
                <div className="border-b border-black/10 pb-4">
                  <h4 className="font-medium text-black mb-1">{toTitleCase('What is the AI Vision feature?')}</h4>
                  <p className="text-sm text-black/70 leading-relaxed">Upload a Pinterest or Instagram makeup screenshot. Our AI analyzes aesthetic tags and color palettes to instantly match you with the best-suited artists.</p>
                </div>
                <div className="border-b border-black/10 pb-4">
                  <h4 className="font-medium text-black mb-1">{toTitleCase('What is the cancellation and rescheduling policy?')}</h4>
                  <p className="text-sm text-black/70 leading-relaxed">You can modify or reschedule bookings through your dashboard up to 48 hours before the event start time by coordinating directly with your artist.</p>
                </div>
              </div>
            </div>
          </motion.aside>
        </div>
      )}
    </div>
  );
}

// ==========================================
// ROUTER
// ==========================================
function Router({ session, styleVersion }: { session: Session | null; styleVersion: string }) {
  const [authOpen, setAuthOpen] = useState(false);
  const [location] = useLocation();

  return (
    <ErrorBoundary resetKey={location}>
      <Switch>
        <Route path="/">
          <Home session={session} setAuthOpen={setAuthOpen} styleVersion={styleVersion} />
        </Route>
        <Route path="/dashboard">
          {() => <Dashboard session={session} />}
        </Route>
        <Route path="/beauty-demo">
          {() => <BeautyDemo setAuthOpen={setAuthOpen} />}
        </Route>
        <Route path="/artist/:id">
          {() => <BeautyDemo setAuthOpen={setAuthOpen} />}
        </Route>
        <Route component={NotFound} />
      </Switch>

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </ErrorBoundary>
  );
}

// ==========================================
// APP ROOT
// ==========================================

function JournalSectionSessionWrapper({ session, setAuthOpen, theme }: { session: any; setAuthOpen: (open: boolean) => void; theme: any }) {
  const [articles, setArticles] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isWriting, setIsWriting] = useState(false);
  const [showAllModal, setShowAllModal] = useState(false);
  const [activeArticle, setActiveArticle] = useState<any>(null);
  
  const [, setLocation] = useLocation();
  const queryParams = new URLSearchParams(window.location.search);
  const styleVersion = queryParams.get('style') || '2';
  
  // Form state
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('BRIDAL CRAFT');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [content, setContent] = useState('');
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    fetchArticles();
  }, []);

  const fetchArticles = async () => {
    const { data, error } = await supabase
      .from('journal_articles')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (!error && data) {
      setArticles(data);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.user) {
      setAuthOpen(true);
      return;
    }

    setPublishing(true);
    let uploadedImageUrl = null;

    try {
      if (imageFile) {
        const fileExt = imageFile.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
        const filePath = `journal-images/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('art-uploads')
          .upload(filePath, imageFile);

        if (!uploadError) {
          const { data: publicURLData } = supabase.storage
            .from('art-uploads')
            .getPublicUrl(filePath);
          uploadedImageUrl = publicURLData.publicUrl;
        }
      }

      let authorDisplayName = session.user.user_metadata?.full_name || session.user.user_metadata?.first_name || 'Community Member';
      
      const { data: artistProfile } = await supabase
        .from('artist_profiles')
        .select('business_name')
        .eq('id', session.user.id)
        .single();

      if (artistProfile?.business_name) {
        authorDisplayName = artistProfile.business_name;
      }

      const userRole = session.user.user_metadata?.role || 'client';
      const readTime = `${Math.ceil(content.split(' ').length / 200)} min read`;

      const { error } = await supabase.from('journal_articles').insert({
        author_id: session.user.id,
        author_name: authorDisplayName,
        author_role: userRole,
        title,
        category: category.toUpperCase(),
        read_time: readTime,
        content,
        image_url: uploadedImageUrl
      });

      if (error) throw error;

      setTitle('');
      setImageFile(null);
      setImagePreview('');
      setContent('');
      setIsWriting(false);
      fetchArticles();
    } catch (err: any) {
      alert("Failed to publish: " + (err.message || err));
    } finally {
      setPublishing(false);
    }
  };

  const filteredArticles = articles.filter(art => 
    art.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    art.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
    art.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
    art.author_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const displayArticles = filteredArticles;
  const featuredArticle = displayArticles[0];
  const sideArticles = displayArticles.slice(1, 3);

  const navigateToArtist = (authorId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (authorId) {
      setShowAllModal(false);
      setActiveArticle(null);
      setLocation(`/artist/${authorId}?style=${styleVersion}`);
    }
  };

  return (
    <section id="journal" className="bg-[#0A0510] text-white mx-auto w-full px-6 py-28 sm:px-12 lg:px-20">
      <div className="max-w-[1400px] mx-auto">
        
        {/* Luxury Header */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between mb-16 gap-8 border-b border-white/10 pb-12">
          <div>
            <p className={`${theme.eyebrow} text-[#E2BE68] mb-3 tracking-widest`}>from the journal</p>
            <h2 className={`${theme.headingHero} text-white text-5xl sm:text-6xl`}>
              From The <span className={`${theme.premiumTag} text-[#E2BE68] italic`}>Journal.</span>
            </h2>
            <p className={`${theme.bodyText} text-white/60 mt-4 max-w-xl text-sm leading-relaxed`}>
              A curated editorial space where artists and clients share expert beauty tips, product reviews, personal routines, and industry perspectives.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
            <button 
              type="button" 
              onClick={() => setShowAllModal(true)} 
              className="border-b border-white/30 pb-1 text-white text-xs uppercase tracking-widest hover:text-[#E2BE68] transition text-left"
            >
              read all stories ({articles.length}) →
            </button>

            <button 
              onClick={() => {
                if (!session?.user) {
                  setAuthOpen(true);
                } else {
                  setIsWriting(!isWriting);
                }
              }}
              className="flex items-center justify-center gap-2 px-6 py-2.5 bg-[#E2BE68] text-black text-xs font-medium uppercase tracking-widest rounded-full hover:bg-white transition shadow-md"
            >
              <PlusCircle size={14} /> {isWriting ? 'Close Editor' : 'Write Article'}
            </button>
          </div>
        </div>

        {/* Spacious Publishing Modal Drawer */}
        {isWriting && (
          <div className="bg-[#12081d] border border-[#E2BE68]/40 p-8 sm:p-14 rounded-3xl mb-16 space-y-8 max-w-4xl mx-auto shadow-2xl relative animate-in fade-in duration-300">
            <button onClick={() => setIsWriting(false)} className="absolute right-6 top-6 text-white/50 hover:text-white p-2 bg-white/5 rounded-full transition"><X size={20}/></button>
            <div className="border-b border-white/10 pb-5">
              <h3 className="text-3xl font-serif text-[#E2BE68]">Publish to The Journal</h3>
              <p className="text-xs text-white/50 mt-1">Share your expert beauty tips, bridal craft, or industry perspective with the community.</p>
            </div>
            
            <form onSubmit={handlePublish} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="block text-[11px] uppercase tracking-widest text-white/70 mb-2 font-mono">Article Title *</label>
                  <input 
                    type="text" required value={title} onChange={(e) => setTitle(e.target.value)} 
                    placeholder="E.g., The Anatomy of South Indian Draping" 
                    className="w-full bg-black/50 border border-white/15 rounded-xl px-4 py-3.5 text-xs text-white focus:outline-none focus:border-[#E2BE68]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] uppercase tracking-widest text-white/70 mb-2 font-mono">Category *</label>
                  <select 
                    value={category} onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-[#1b1222] border border-white/15 rounded-xl px-4 py-3.5 text-xs text-white focus:outline-none focus:border-[#E2BE68]"
                  >
                    <option value="BRIDAL CRAFT">Bridal Craft</option>
                    <option value="SKINCARE">Skincare</option>
                    <option value="INDUSTRY">Industry</option>
                    <option value="PERSPECTIVE">Perspective</option>
                    <option value="PRODUCT REVIEW">Product Review</option>
                    <option value="MAKEUP TRENDS">Makeup Trends</option>
                    <option value="HAIR & GROOMING">Hair & Grooming</option>
                    <option value="CLIENT GUIDE">Client Guide</option>
                    <option value="ARTIST SPOTLIGHT">Artist Spotlight</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] uppercase tracking-widest text-white/70 mb-2 font-mono">Featured Cover Image (Optional)</label>
                <div className="flex items-center gap-4">
                  <label className="cursor-pointer px-5 py-3 bg-white/10 border border-white/20 text-white rounded-xl text-xs uppercase tracking-wider hover:bg-white/20 transition">
                    Choose Image File
                    <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                  </label>
                  <span className="text-xs text-white/50 truncate max-w-sm">
                    {imageFile ? imageFile.name : 'No file chosen (will use clean dark background)'}
                  </span>
                </div>
                {imagePreview && (
                  <div className="mt-3 w-32 h-20 rounded-xl overflow-hidden border border-white/20">
                    <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-[11px] uppercase tracking-widest text-white/70 mb-2 font-mono">Your Content * (Supports long-form articles & paragraphs)</label>
                <textarea 
                  required rows={12} value={content} onChange={(e) => setContent(e.target.value)} 
                  placeholder="Write or paste your detailed article here..." 
                  className="w-full bg-black/50 border border-white/15 rounded-2xl p-5 text-sm text-white focus:outline-none focus:border-[#E2BE68] leading-relaxed font-sans"
                />
              </div>

              <div className="flex justify-end gap-4 pt-4 border-t border-white/10">
                <button type="button" onClick={() => setIsWriting(false)} className="px-7 py-3 border border-white/25 text-white rounded-full text-xs uppercase tracking-wider hover:bg-white/10 transition">
                  Cancel
                </button>
                <button type="submit" disabled={publishing} className="px-9 py-3 bg-[#E2BE68] text-black font-semibold uppercase tracking-wider text-xs rounded-full hover:bg-white transition disabled:opacity-50 shadow-lg">
                  {publishing ? 'Publishing Story...' : 'Publish Story →'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Homepage Editorial Grid */}
        {displayArticles.length > 0 ? (
          <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
            {featuredArticle && (
              <div onClick={() => setActiveArticle(featuredArticle)} className="group relative min-h-[440px] overflow-hidden border border-white/10 bg-[#150A26] flex flex-col justify-between cursor-pointer hover:border-[#E2BE68]/50 transition-all rounded-2xl">
                {featuredArticle.image_url ? (
                  <div className="absolute inset-0 z-0 opacity-25 group-hover:opacity-40 transition-opacity">
                    <img src={featuredArticle.image_url} alt="" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#150A26] via-[#150A26]/80 to-transparent"></div>
                  </div>
                ) : (
                  <div className="absolute inset-0 z-0 bg-[#150A26]"></div>
                )}
                <div className="relative z-10 p-10 sm:p-12">
                  <span className={`${theme.eyebrow} text-[11px] text-[#E2BE68]`}>
                    {featuredArticle.category} · {featuredArticle.read_time}
                  </span>
                  <div className="mt-6">
                    <h3 className="text-3xl sm:text-4xl font-serif text-white group-hover:text-[#E2BE68] transition-colors leading-snug">
                      {featuredArticle.title}
                    </h3>
                    <p className={`${theme.bodyText} text-white/60 text-sm mt-4 leading-relaxed line-clamp-3`}>
                      {featuredArticle.content}
                    </p>
                  </div>
                </div>
                {/* Featured Card Footer with Clickable Author Link */}
                <div className="relative z-10 p-10 pt-0 pb-12 border-t border-white/10 flex items-center justify-between text-xs text-white/85 font-sans">
                  <span 
                    onClick={(e) => navigateToArtist(featuredArticle.author_id, e)}
                    className="hover:text-[#E2BE68] hover:underline cursor-pointer transition-colors"
                  >
                    By {featuredArticle.author_name}
                  </span>
                  <span className="text-[#E2BE68] group-hover:translate-x-1 transition-transform flex items-center gap-1 font-medium">Read Article <BookOpen size={12}/></span>
                </div>
              </div>
            )}

            <div className="grid gap-6">
              {sideArticles.map((art) => (
                <div key={art.id} onClick={() => setActiveArticle(art)} className="group relative overflow-hidden border border-white/10 bg-[#150A26] p-8 sm:p-10 cursor-pointer hover:border-[#E2BE68]/50 transition-all rounded-2xl flex flex-col justify-between">
                  {art.image_url ? (
                    <div className="absolute inset-0 z-0 opacity-20 group-hover:opacity-30 transition-opacity">
                      <img src={art.image_url} alt="" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#150A26] via-[#150A26]/90 to-transparent"></div>
                    </div>
                  ) : (
                    <div className="absolute inset-0 z-0 bg-[#150A26]"></div>
                  )}
                  <div className="relative z-10">
                    <span className={`${theme.eyebrow} text-[11px] text-[#E2BE68]`}>
                      {art.category} · {art.read_time}
                    </span>
                    <h3 className="text-2xl font-serif text-white mt-3 group-hover:text-[#E2BE68] transition-colors">
                      {art.title}
                    </h3>
                    <p className={`${theme.bodyText} text-white/60 text-xs mt-2 line-clamp-2`}>{art.content}</p>
                  </div>
                  
                  {/* Side Cards Footer with Clickable Author Link */}
                  <div className="relative z-10 pt-4 mt-4 border-t border-white/10 flex items-center justify-between text-xs text-white/85 font-sans">
                    <span 
                      onClick={(e) => navigateToArtist(art.author_id, e)}
                      className="hover:text-[#E2BE68] hover:underline cursor-pointer transition-colors"
                    >
                      By {art.author_name}
                    </span>
                    <span className="text-[#E2BE68] font-medium">Read →</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-[#150A26] border border-white/10 rounded-2xl p-16 text-center text-white/50 text-sm italic">
            No articles published yet. Click "Write Article" to publish the first story!
          </div>
        )}

        {/* FULL ARCHIVE MODAL */}
        {showAllModal && (
          <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col p-6 sm:p-12 overflow-y-auto animate-in fade-in duration-300">
            <div className="max-w-[1400px] w-full mx-auto">
              
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-white/10 pb-8 mb-12">
                <div>
                  <p className="text-xs uppercase tracking-[0.25em] text-[#E2BE68] mb-2 font-mono">complete archive</p>
                  <h2 className="text-3xl sm:text-4xl font-serif text-white">All Journal Stories & Tips</h2>
                </div>

                <div className="flex items-center gap-4">
                  <div className="relative w-full sm:w-80">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" size={16} />
                    <input 
                      type="text" 
                      placeholder="Search through all articles..." 
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-full pl-11 pr-4 py-2.5 text-xs text-white placeholder-white/40 focus:outline-none focus:border-[#E2BE68]"
                    />
                  </div>
                  <button 
                    onClick={() => setShowAllModal(false)}
                    className="px-5 py-2.5 bg-white/10 text-white rounded-full text-xs uppercase tracking-wider hover:bg-white/20 transition flex items-center gap-2"
                  >
                    <X size={14} /> Close
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {displayArticles.map((art) => (
                  <div key={art.id} onClick={() => { setShowAllModal(false); setActiveArticle(art); }} className="bg-[#150A26] border border-white/10 p-8 rounded-2xl flex flex-col justify-between hover:border-[#E2BE68]/50 transition cursor-pointer">
                    <div>
                      <div className="flex items-center justify-between text-[11px] text-[#E2BE68] uppercase tracking-widest mb-4 font-mono">
                        <span>{art.category}</span>
                        <span>{art.read_time}</span>
                      </div>
                      <h3 className="text-xl font-serif text-white mb-3">{art.title}</h3>
                      <p className="text-white/60 text-xs leading-relaxed mb-6 line-clamp-3">{art.content}</p>
                    </div>
                    {/* Archive Card Footer with Clickable Author Link */}
                    <div className="pt-4 border-t border-white/10 flex items-center justify-between text-[11px] text-white/85 font-sans">
                      <span 
                        onClick={(e) => navigateToArtist(art.author_id, e)}
                        className="hover:text-[#E2BE68] hover:underline cursor-pointer transition-colors"
                      >
                        By {art.author_name}
                      </span>
                      <span className="text-[#E2BE68] capitalize font-medium">{art.author_role}</span>
                    </div>
                  </div>
                ))}
              </div>

            </div>
          </div>
        )}

        {/* INDIVIDUAL ARTICLE READER MODAL */}
        {activeArticle && (
          <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-lg flex items-center justify-center p-4 sm:p-8 overflow-y-auto animate-in fade-in duration-300">
            <div className="bg-[#150A26] border border-[#E2BE68]/30 max-w-3xl w-full p-8 sm:p-14 rounded-3xl relative shadow-2xl my-auto">
              <button 
                onClick={() => setActiveArticle(null)} 
                className="absolute right-6 top-6 text-white/50 hover:text-white p-2 bg-white/5 rounded-full transition z-20"
              >
                <X size={20}/>
              </button>

              <div className="space-y-6">
                <div className="flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-[#E2BE68] font-mono">
                  <span>{activeArticle.category}</span>
                  <span>·</span>
                  <span>{activeArticle.read_time}</span>
                </div>

                <h2 className="text-3xl sm:text-5xl font-serif text-white leading-tight">
                  {activeArticle.title}
                </h2>

                {/* Reader Modal Header with Clickable Author Link */}
                <div className="flex items-center gap-4 py-4 border-y border-white/10 text-xs text-white/85 font-sans">
                  <span 
                    onClick={(e) => navigateToArtist(activeArticle.author_id, e)}
                    className="text-white hover:text-[#E2BE68] hover:underline cursor-pointer font-medium transition-colors"
                  >
                    By {activeArticle.author_name}
                  </span>
                  <span>•</span>
                  <span className="capitalize text-[#E2BE68] font-medium">{activeArticle.author_role}</span>
                </div>

                {activeArticle.image_url ? (
                  <div className="w-full h-64 sm:h-80 rounded-2xl overflow-hidden border border-white/10 my-4">
                    <img src={activeArticle.image_url} alt="" className="w-full h-full object-cover" />
                  </div>
                ) : null}

                <div className="text-white/80 text-sm sm:text-base leading-relaxed font-sans space-y-4 pt-2 whitespace-pre-line">
                  <p>{activeArticle.content}</p>
                </div>

                <div className="pt-8 border-t border-white/10 flex justify-end">
                  <button 
                    onClick={() => setActiveArticle(null)}
                    className="px-8 py-3 bg-[#E2BE68] text-black text-xs uppercase tracking-widest font-semibold rounded-full hover:bg-white transition"
                  >
                    Close Story
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </section>
  );
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [updatingRole, setUpdatingRole] = useState(false);

const queryParams = new URLSearchParams(window.location.search);
  const styleVersion = queryParams.get('style') || '2';
  const theme = getTheme(styleVersion);

  // AUTOMATIC URL CLEANUP: Removes ?style= from the address bar on load
  useEffect(() => {
    if (queryParams.has('style')) {
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  useEffect(() => {
    const checkSession = async () => {
      const isOAuth = window.location.hash.includes('access_token=') || window.location.search.includes('code=');
      const { data: { session } } = await supabase.auth.getSession();

      setSession(session);

      if (!isOAuth) {
        setLoadingSession(false);
      }
    };

    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, currentSession) => {
      setSession(currentSession);
      const isOAuth = window.location.hash.includes('access_token=') || window.location.search.includes('code=');

      if (isOAuth) {
        if (event === 'SIGNED_IN') setLoadingSession(false);
      } else {
        setLoadingSession(false);
      }
    });

    const fallbackTimer = setTimeout(() => setLoadingSession(false), 3000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(fallbackTimer);
    };
  }, []);

  const handleGlobalSelectRole = async (selectedRole: 'client' | 'artist') => {
    if (!session?.user) return;
    setUpdatingRole(true);

    try {
      const { error } = await supabase.auth.updateUser({ data: { role: selectedRole } });
      if (error) throw error;

      const fullName = session.user.user_metadata?.name || session.user.user_metadata?.full_name || 'User';
      await supabase.from('profiles').upsert({ id: session.user.id, role: selectedRole, full_name: fullName });

      if (selectedRole === 'artist') {
        await supabase.from('artist_profiles').upsert({ id: session.user.id });
      }

      window.location.href = `/dashboard?style=${styleVersion}`;
    } catch (err: any) {
      window.alert(`Failed to switch role: ${err.message}`);
      setUpdatingRole(false);
    }
  };

  if (loadingSession) {
    return (
      <div className={`h-screen w-full bg-[#FDF3F1] flex items-center justify-center fixed inset-0 z-[9999] ${theme.fontBase}`}>
        <p className={`${theme.eyebrow} animate-pulse`}>{toTitleCase('authenticating...')}</p>
      </div>
    );
  }

  const userRole = session?.user?.user_metadata?.role;
  const needsRole = session && (!userRole || (userRole !== 'client' && userRole !== 'artist'));

  if (needsRole) {
    return (
      <div className={`h-screen w-full flex flex-col md:flex-row overflow-hidden bg-[#FDF3F1] fixed inset-0 z-[9999] ${theme.fontBase}`}>
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          onClick={() => !updatingRole && handleGlobalSelectRole('client')}
          className="flex-1 relative bg-[#FDF3F1] text-black flex flex-col items-center justify-center p-8 md:p-12 cursor-pointer group"
        >
          <div className="absolute inset-0 overflow-hidden">
            <img src="https://images.unsplash.com/photo-1516975080661-46bfa2c281c7?auto=format&fit=crop&w=1200&q=80" alt="Client" className="w-full h-full object-cover opacity-0 group-hover:opacity-[0.03] transition-opacity duration-700" />
          </div>
          <div className="relative z-10 text-center transform group-hover:-translate-y-2 transition-transform duration-700">
            <p className={`${theme.eyebrow} mb-6`}>{toTitleCase('for clients')}</p>
            <h2 className={`${theme.headingHero} mb-6`}>
              {toTitleCase('i am looking')}<br />{toTitleCase('for an artist')}
            </h2>
            <div className={theme.btnPrimary}>
              {updatingRole ? 'setting up...' : 'join as client'}
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          onClick={() => !updatingRole && handleGlobalSelectRole('artist')}
          className="flex-1 relative bg-[#05020A] text-white flex flex-col items-center justify-center p-8 md:p-12 cursor-pointer group border-t md:border-t-0 md:border-l border-white/10"
        >
          <div className="absolute inset-0 overflow-hidden">
            <img src="https://images.unsplash.com/photo-1522337360788-8b13dee7a3af?auto=format&fit=crop&w=1200&q=80" alt="Artist" className="w-full h-full object-cover opacity-0 group-hover:opacity-10 transition-opacity duration-700 grayscale" />
          </div>
          <div className="relative z-10 text-center transform group-hover:-translate-y-2 transition-transform duration-700">
            <p className={`${theme.eyebrow} mb-6`}>{toTitleCase('for professionals')}</p>
            <h2 className={`${theme.headingHero} !text-white mb-6`}>
              {toTitleCase('i am a')}<br />{toTitleCase('makeup artist')}
            </h2>
            <div className={theme.btnPrimary}>
              {updatingRole ? 'setting up...' : 'apply to roster'}
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router session={session} styleVersion={styleVersion} />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}