import { PageBanner } from '../../components/layout/PageBanner.jsx';
import { CalendarView } from '../../components/calendar/Calendar.jsx';

/** FR-CAL-01..06: the calendar every role can open from the icon at the top right. */
export function CalendarPage() {
  return (
    <>
      <PageBanner
        title="Calendar"
        description="Every approved event, registration deadline and recruitment on campus."
      />
      <CalendarView />
    </>
  );
}
