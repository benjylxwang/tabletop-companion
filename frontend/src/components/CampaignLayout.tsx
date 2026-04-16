import { Outlet } from 'react-router-dom';

/**
 * Thin passthrough layout for campaign routes.
 * Navigation and the DM/Player toggle are handled by the root Layout sidebar.
 */
export default function CampaignLayout() {
  return <Outlet />;
}
