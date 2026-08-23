import './customerBriefing.css';
import CustomerBriefingDesktop from './CustomerBriefingDesktop.jsx';
import CustomerBriefingMobile from './CustomerBriefingMobile.jsx';

export default function CustomerBriefing({ briefing, actions }) {
  if (!briefing) return null;

  return (
    <>
      <CustomerBriefingDesktop briefing={briefing} actions={actions} />
      <CustomerBriefingMobile briefing={briefing} actions={actions} />
    </>
  );
}
