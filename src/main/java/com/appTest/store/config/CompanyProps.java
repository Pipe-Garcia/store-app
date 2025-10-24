// src/main/java/com/appTest/store/config/CompanyProps.java
package com.appTest.store.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;
import lombok.Getter;
import lombok.Setter;

@Getter @Setter
@Component
@ConfigurationProperties(prefix = "company")
public class CompanyProps {
    private String name;
    private String cuit;
    private String iibb;
    private String address;
    private String phone;
    private String email;
    private String web;
    private String logo;
}

