package com.appTest.store.audit;

import java.lang.annotation.*;

@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
@Documented
public @interface Auditable {
    String action();      // p.e. "SALE_CREATE", "ORDER_UPDATE", "DELIVERY_CREATE"
    String entity();      // p.e. "Sale", "Orders", "Delivery"
    String idParam() default ""; // nombre del parámetro que contiene el ID (si aplica)
}

