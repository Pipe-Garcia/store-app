package com.appTest.store.audit;

import jakarta.servlet.*;
import jakarta.servlet.http.HttpServletRequest;

import java.io.IOException;
import java.util.UUID;

/** Captura requestId, IP y User-Agent en un ThreadLocal para auditoría. */
public class AuditRequestContextFilter implements Filter {
    @Override
    public void doFilter(ServletRequest req, ServletResponse res, FilterChain chain)
            throws IOException, ServletException {
        try {
            HttpServletRequest http = (HttpServletRequest) req;
            String requestId = http.getHeader("X-Request-Id");
            if (requestId == null || requestId.isBlank()) requestId = UUID.randomUUID().toString();

            String ip = http.getHeader("X-Forwarded-For");
            if (ip == null || ip.isBlank()) ip = req.getRemoteAddr();

            String ua = http.getHeader("User-Agent");

            RequestContext.set(new RequestContext(requestId, ip, ua));
            chain.doFilter(req, res);
        } finally {
            RequestContext.clear();
        }
    }
}
