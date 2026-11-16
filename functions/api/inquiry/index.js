// POST /api/inquiry: the cake order form sends a new order here (see server/inquiry.js).
import { startInquiry } from '../../../server/inquiry.js'

export const onRequestPost = ({ request, env }) => startInquiry(request, env)
