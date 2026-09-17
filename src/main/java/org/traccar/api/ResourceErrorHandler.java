/*
 * Copyright 2015 - 2019 Anton Tananaev (anton@traccar.org)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package org.traccar.api;

import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.ext.ExceptionMapper;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class ResourceErrorHandler implements ExceptionMapper<Exception> {

    private static final Logger LOGGER = LoggerFactory.getLogger(ResourceErrorHandler.class);

    @Override
    public Response toResponse(Exception exception) {
        Response.ResponseBuilder builder;
        String message;
        if (exception instanceof WebApplicationException webException) {
            builder = Response.fromResponse(webException.getResponse());
            var status = Response.Status.fromStatusCode(webException.getResponse().getStatus());
            message = status != null ? status.getReasonPhrase() : "Request failed";
        } else {
            // Preserve the existing HTTP contract while removing implementation details.
            builder = Response.status(Response.Status.BAD_REQUEST);
            message = "Request failed";
        }
        if (exception instanceof SecurityException) {
            message = "Write access denied".equals(exception.getMessage())
                    ? "Write access denied" : "User access denied";
        }
        LOGGER.warn("API request failed", exception);
        return builder.entity(message).type(MediaType.TEXT_PLAIN_TYPE)
                .header("Cache-Control", "no-store").header("Content-Length", null)
                .header("Content-Encoding", null).build();
    }

}
