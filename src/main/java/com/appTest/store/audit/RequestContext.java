package com.appTest.store.audit;

import lombok.*;

@Getter @AllArgsConstructor
public class RequestContext {
    private final String requestId;
    private final String ip;
    private final String userAgent;

    private static final ThreadLocal<RequestContext> TL = new ThreadLocal<>();
    public static void set(RequestContext ctx){ TL.set(ctx); }
    public static RequestContext get(){ return TL.get(); }
    public static void clear(){ TL.remove(); }
}

