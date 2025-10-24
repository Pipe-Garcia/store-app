package com.appTest.store.config;

import com.appTest.store.audit.AuditRequestContextFilter;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.Ordered;

@Configuration
public class WebConfig {

    @Bean(name = "auditRequestContextFilter")
    public FilterRegistrationBean<AuditRequestContextFilter> auditRequestContextFilter() {
        FilterRegistrationBean<AuditRequestContextFilter> reg = new FilterRegistrationBean<>();
        reg.setFilter(new AuditRequestContextFilter());
        reg.setName("auditRequestContextFilter");
        reg.addUrlPatterns("/*");
        reg.setOrder(Ordered.HIGHEST_PRECEDENCE); // antes que el resto
        return reg;
    }
}
