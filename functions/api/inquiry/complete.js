// POST /api/inquiry/complete: finishes an order once its photos are uploaded (see server/inquiry.js).
import { completeInquiry } from '../../../server/inquiry.js'

export const onRequestPost = ({ request, env }) => completeInquiry(request, env)
